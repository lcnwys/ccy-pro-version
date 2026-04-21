import initSqlJs, { Database } from 'sql.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

let db: Database | null = null;
let dbInitialized = false;
let saveTimer: NodeJS.Timeout | null = null;

const getDbPath = () => {
  return process.env.DATABASE_PATH || join(__dirname, '..', '..', 'data', 'app.db');
};

// 获取 sql.js WASM 文件路径
const getSqlJsWasmPath = () => {
  const sqlJsPath = require.resolve('sql.js');
  const sqlJsDir = join(sqlJsPath, '..', '..');
  return join(sqlJsDir, 'dist', 'sql-wasm.wasm');
};

export const getDatabase = async (): Promise<Database> => {
  if (db && dbInitialized) {
    return db;
  }

  const wasmPath = getSqlJsWasmPath();
  console.log('[Database] Loading WASM from:', wasmPath);

  // 读取 WASM 文件
  const wasmBinary = readFileSync(wasmPath) as unknown as ArrayBuffer;

  const SQL = await initSqlJs({
    wasmBinary: wasmBinary
  });

  const dbPath = getDbPath();
  console.log('[Database] DB Path:', dbPath);

  let loadedFromFile = false;
  try {
    const fileExists = await readFile(dbPath).catch(() => null);
    if (fileExists && fileExists.length > 0) {
      console.log('[Database] Loading existing database from file');
      db = new SQL.Database(fileExists);
      loadedFromFile = true;
    } else {
      console.log('[Database] Creating new database in memory');
      await mkdir(join(__dirname, '..', '..', 'data'), { recursive: true });
      db = new SQL.Database();
    }
  } catch (err) {
    console.log('[Database] Creating new database in memory (error:', err, ')');
    db = new SQL.Database();
  }

  // 创建所有表（包含迁移检查）
  console.log('[Database] Creating tables...');
  try {
    createTables(db, loadedFromFile);
    dbInitialized = true;
    console.log('[Database] Initialized successfully at:', dbPath);

    // 如果是新创建的数据库（不是从文件加载），则保存到文件
    if (!loadedFromFile) {
      await saveDatabase();
      console.log('[Database] Saved to file (new database)');
    } else {
      console.log('[Database] Using existing database file');
    }
  } catch (err) {
    console.error('[Database] Error creating tables:', err);
    throw err;
  }
  return db;
};

// 强制重置数据库（用于迁移）
export const resetDatabase = async (): Promise<void> => {
  if (db) {
    db.close();
    db = null;
  }
  dbInitialized = false;

  const dbPath = getDbPath();
  try {
    // 尝试删除文件
    await writeFile(dbPath, Buffer.from([]));
    console.log('[Database] Database file cleared');
  } catch (e) {
    console.log('[Database] Could not clear database file:', e);
  }
};

const createTables = (database: Database, loadedFromFile: boolean = false) => {
  const ensureColumn = (tableName: string, columnName: string, definition: string) => {
    const columns = database.exec(`PRAGMA table_info(${tableName})`);
    const existingColumns = columns[0]?.values.map((row) => String(row[1])) || [];
    if (!existingColumns.includes(columnName)) {
      database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  };

  // ==================== 用户系统 ====================

  // 用户表 - 重构后：用户直接关联团队
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'member' CHECK(role IN ('super_admin', 'member')),
      team_id INTEGER,
      is_team_admin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `);

  // 团队表 - 新增 api_key 字段
  database.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      api_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  // 团队成员关系表 - 保留用于多团队场景
  database.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, user_id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ==================== API Key 管理 ====================

  // 检查是否需要重建 api_keys 表（仅首次创建或 schema 不匹配时）
  const existingTableCheck = database.exec(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='api_keys'
  `);

  if (existingTableCheck.length > 0) {
    const createSql = existingTableCheck[0]?.values[0]?.[0] as string;
    if (createSql && !createSql.includes('key_value')) {
      console.log('[Database] api_keys table missing key_value column, dropping...');
      database.exec('DROP TABLE IF EXISTS api_keys');
    } else if (createSql && createSql.includes('key_value')) {
      console.log('[Database] api_keys table schema is correct, skipping migration');
    }
  }

  // API Key 表（平台级）
  database.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value TEXT UNIQUE NOT NULL,
      name TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME
    )
  `);

  // ==================== 预算和额度管理 ====================

  // 预算表（平台给团队分配）
  database.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      used_amount INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 额度分配表（团队给成员分配）
  database.exec(`
    CREATE TABLE IF NOT EXISTS budget_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      used_amount INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 交易流水表（记录每一笔额度的增减和消耗）
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('recharge', 'allocate', 'consume', 'refund')),
      amount INTEGER NOT NULL,
      team_id INTEGER,
      user_id INTEGER,
      task_id INTEGER,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // ==================== 任务系统 ====================

  // 任务表（增强版）
  database.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      batch_id TEXT NOT NULL,
      function_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'success', 'failed')),
      input_data TEXT NOT NULL,
      output_data TEXT,
      result_url TEXT,
      task_id_origin TEXT,
      cost INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    )
  `);

  ensureColumn('tasks', 'workflow_id', 'INTEGER');
  ensureColumn('tasks', 'workflow_run_id', 'INTEGER');
  ensureColumn('tasks', 'workflow_step_key', 'TEXT');
  ensureColumn('tasks', 'workflow_step_name', 'TEXT');
  ensureColumn('tasks', 'workflow_item_index', 'INTEGER');

  database.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      team_id INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      steps_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'partial_success', 'success', 'failed')),
      concurrency INTEGER NOT NULL DEFAULT 1,
      total_items INTEGER NOT NULL DEFAULT 0,
      completed_items INTEGER NOT NULL DEFAULT 0,
      failed_items INTEGER NOT NULL DEFAULT 0,
      total_steps INTEGER NOT NULL DEFAULT 0,
      run_batch_id TEXT NOT NULL,
      input_items_json TEXT NOT NULL,
      results_json TEXT,
      error_message TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL DEFAULT 0,
      file_id TEXT UNIQUE NOT NULL,
      local_file TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      source_type TEXT DEFAULT 'upload' CHECK(source_type IN ('upload', 'generated')),
      task_id INTEGER,
      workflow_run_id INTEGER,
      tags_json TEXT,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id)
    )
  `);

  // 检查 materials 表是否需要迁移（添加缺失的列）
  const materialsTableCheck = database.exec(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='materials'
  `);

  if (materialsTableCheck.length > 0) {
    const createSql = materialsTableCheck[0]?.values[0]?.[0] as string;
    if (createSql && !createSql.includes('task_id')) {
      console.log('[Database] materials table missing task_id column, adding...');
      database.exec('ALTER TABLE materials ADD COLUMN task_id INTEGER');
    }
    if (createSql && !createSql.includes('workflow_run_id')) {
      console.log('[Database] materials table missing workflow_run_id column, adding...');
      database.exec('ALTER TABLE materials ADD COLUMN workflow_run_id INTEGER');
    }
    if (createSql && !createSql.includes('result_url')) {
      console.log('[Database] materials table missing result_url column, adding...');
      database.exec('ALTER TABLE materials ADD COLUMN result_url TEXT');
    }
    if (createSql && !createSql.includes('image_width')) {
      console.log('[Database] materials table missing image_width/image_height columns, adding...');
      database.exec('ALTER TABLE materials ADD COLUMN image_width INTEGER');
      database.exec('ALTER TABLE materials ADD COLUMN image_height INTEGER');
    }
  }

  // ==================== 使用统计 ====================

  // 使用统计表
  database.exec(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER,
      user_id INTEGER,
      function_type TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      total_cost INTEGER DEFAULT 0,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, user_id, function_type),
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ==================== 索引 ====================

  database.exec(`
    -- 用户相关索引
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

    -- 团队相关索引
    CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);

    -- 团队成员相关索引
    CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

    -- 任务相关索引
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_function_type ON tasks(function_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_workflow_run_id ON tasks(workflow_run_id);

    -- 预算相关索引
    CREATE INDEX IF NOT EXISTS idx_budgets_team_id ON budgets(team_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_team_id ON budget_allocations(team_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_user_id ON budget_allocations(user_id);

    -- 交易流水索引
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_team_id ON transactions(team_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

    -- API Key 索引
    CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

    -- Workflow 索引
    CREATE INDEX IF NOT EXISTS idx_workflows_team_id ON workflows(team_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_team_id ON workflow_runs(team_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_created_by ON workflow_runs(created_by);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
    CREATE INDEX IF NOT EXISTS idx_workflow_runs_batch_id ON workflow_runs(run_batch_id);
    CREATE INDEX IF NOT EXISTS idx_materials_team_id ON materials(team_id);
    CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
    CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at);
    CREATE INDEX IF NOT EXISTS idx_materials_source_type ON materials(source_type);
    CREATE INDEX IF NOT EXISTS idx_materials_task_id ON materials(task_id);
    CREATE INDEX IF NOT EXISTS idx_materials_workflow_run_id ON materials(workflow_run_id);
  `);

  // ==================== 初始化数据 ====================

  // 创建默认平台超级管理员（仅首次启动时）
  const existingAdmin = database.exec(`
    SELECT id FROM users WHERE role = 'super_admin'
  `);

  if (existingAdmin.length === 0) {
    // 默认密码：admin123（生产环境请修改）
    const adminPasswordHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    try {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      database.exec(`
        INSERT INTO users (email, password_hash, nickname, role, is_team_admin)
        VALUES ('admin@chcyai.com', '${hash}', '系统管理员', 'super_admin', 0)
      `);
      console.log('[初始化] 默认平台管理员账号已创建 (email: admin@chcyai.com, password: admin123)');
      console.log('[初始化] 生产环境请务必修改默认密码！');
    } catch (e) {
      // bcrypt 不可用时使用简单哈希
      database.exec(`
        INSERT INTO users (email, password_hash, nickname, role, is_team_admin)
        VALUES ('admin@chcyai.com', '${adminPasswordHash}', '系统管理员', 'super_admin', 0)
      `);
      console.log('[初始化] 默认平台管理员账号已创建 (email: admin@chcyai.com, password: admin123)');
      console.log('[初始化] 生产环境请务必修改默认密码！');
    }
  }

  // 修复旧版本遗留的团队 owner 异常数据
  database.exec(`
    UPDATE teams
    SET owner_id = (
      SELECT tm.user_id
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = teams.id
        AND tm.role = 'admin'
      ORDER BY u.is_team_admin DESC, tm.id ASC
      LIMIT 1
    )
    WHERE owner_id IS NULL
      OR owner_id = 0
      OR owner_id NOT IN (SELECT id FROM users)
  `);

  // 清理旧联调遗留的孤儿团队，避免超级管理员列表里混入无成员的坏数据
  database.exec(`
    DELETE FROM teams
    WHERE (owner_id IS NULL OR owner_id = 0 OR owner_id NOT IN (SELECT id FROM users))
      AND id NOT IN (SELECT DISTINCT team_id FROM team_members)
  `);
};

// 保存数据库到文件
export const saveDatabase = async () => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbPath = getDbPath();
  await mkdir(join(__dirname, '..', '..', 'data'), { recursive: true });
  await writeFile(dbPath, buffer);
};

const scheduleDatabaseSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveDatabase();
  }, 50);
};

export const closeDatabase = async () => {
  if (db) {
    await saveDatabase();
    db.close();
    db = null;
    dbInitialized = false;
  }
};

// 辅助函数：执行查询
export const query = (sql: string, params?: unknown[]) => {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params) {
    stmt.bind(params as never[]);
  }
  const results: unknown[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
};

// 辅助函数：执行单个语句
export const exec = (sql: string, params?: unknown[]) => {
  if (!db) throw new Error('Database not initialized');
  if (params && params.length > 0) {
    db.run(sql, params as never[]);
  } else {
    db.run(sql);
  }
  scheduleDatabaseSave();
};

// 辅助函数：获取最后插入的 ID
export const lastInsertRowid = () => {
  if (!db) throw new Error('Database not initialized');
  const result = db.exec('SELECT last_insert_rowid()');
  return result[0]?.values[0]?.[0] as number;
};
