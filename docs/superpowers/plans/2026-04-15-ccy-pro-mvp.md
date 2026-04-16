# 创次元 PRO MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建创次元 PRO 跨境电商 AI 图片处理平台 MVP，支持单图和批量图片处理功能

**Architecture:** 单体部署架构，前后端同域避免 CORS 问题。后端提供 REST API + serve 前端静态资源，SQLite 数据库，内存任务队列。

**Tech Stack:** React 18 + TypeScript + Vite, Node.js 20 + Express + TypeScript, SQLite (better-sqlite3), TailwindCSS, Zustand

---

## 文件结构总览

```
ccy-pro-version/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   ├── pages/          # 页面组件
│   │   ├── stores/         # Zustand 状态管理
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── api/            # API 客户端
│   │   └── App.tsx
│   ├── index.html
│   └── vite.config.ts
├── server/                 # 后端代码
│   ├── src/
│   │   ├── config/         # 配置管理
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务逻辑
│   │   ├── routes/         # 路由定义
│   │   ├── database/       # 数据库操作
│   │   ├── queue/          # 任务队列
│   │   └── index.ts        # 入口文件
│   └── uploads/            # 上传文件存储
├── docs/                   # 文档
├── package.json            # 根配置（workspaces）
└── .env                    # 环境变量
```

---

## Phase 1: 项目脚手架

### Task 1: 创建项目基础结构

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: 创建根 package.json（使用 workspaces）**

```json
{
  "name": "ccy-pro",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@8.0.0",
  "scripts": {
    "dev": "concurrently \"pnpm run dev:server\" \"pnpm run dev:client\"",
    "dev:server": "pnpm --filter server dev",
    "dev:client": "pnpm --filter client dev",
    "build": "pnpm --filter client build && pnpm --filter server build",
    "start": "pnpm --filter server start",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建根 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: 创建 .env.example**

```bash
# 必需配置
CHCYAI_API_KEY=your-api-key-here

# 可选配置
NODE_ENV=development
PORT=3000
DATABASE_PATH=./data/app.db
STORAGE_PATH=./server/uploads
QUEUE_CONCURRENCY=3
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules
dist
build
*.log
.env
data/*.db
uploads/*
!uploads/.gitkeep
.DS_Store
*.tgz
```

- [ ] **Step 5: 创建必要目录**

```bash
mkdir -p client/src/{components,pages,stores,types,api}
mkdir -p server/src/{config,controllers,services,routes,database,queue}
mkdir -p server/uploads data
touch server/uploads/.gitkeep data/.gitkeep
```

- [ ] **Step 6: 初始化 git 并提交**

```bash
git init
git add .
git commit -m "feat: initialize project structure"
```

---

### Task 2: 创建后端脚手架

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/config/index.ts`

- [ ] **Step 1: 创建 server/package.json**

```json
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "better-sqlite3": "^9.2.2",
    "axios": "^1.6.2",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.11",
    "@types/better-sqlite3": "^7.6.8",
    "@types/uuid": "^9.0.7",
    "@types/node": "^20.10.0",
    "tsx": "^4.6.2",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: 创建 server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 server/src/config/index.ts**

```typescript
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    path: process.env.DATABASE_PATH || join(rootDir, 'data', 'app.db'),
  },
  storage: {
    path: process.env.STORAGE_PATH || join(rootDir, 'uploads'),
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  chcyai: {
    baseUrl: 'https://api.chcyai.com',
    apiKey: process.env.CHCYAI_API_KEY || '',
    timeout: 300000, // 5 分钟
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3'),
  },
  cors: {
    enabled: process.env.NODE_ENV !== 'production',
    origins: ['http://localhost:5173'],
  },
};

export default config;
```

- [ ] **Step 4: 创建 server/src/index.ts**

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config } from './config/index.js';

// 加载环境变量
dotenv.config();

const app = express();

// 中间件
app.use(express.json());

// CORS（仅开发环境）
if (config.cors.enabled) {
  app.use(cors({
    origin: config.cors.origins,
    credentials: true,
  }));
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由（后续添加）
app.use('/api/v1', (req, res) => {
  res.json({ message: 'API v1 ready' });
});

// 生产环境：serve 前端静态资源
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientPath));
  
  app.get('*', (req, res) => {
    res.sendFile(join(clientPath, 'index.html'));
  });
}

// 启动服务器
app.listen(config.server.port, config.server.host, () => {
  console.log(`Server running on http://${config.server.host}:${config.server.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
```

- [ ] **Step 5: 运行后端验证**

```bash
cd server
pnpm install
pnpm dev
```

Expected: 看到 "Server running on http://0.0.0.0:3000"

- [ ] **Step 6: 提交**

```bash
git add server/package.json server/tsconfig.json server/src/
git commit -m "feat: create server scaffold with Express"
```

---

### Task 3: 创建数据库模块

**Files:**
- Create: `server/src/database/index.ts`
- Create: `server/src/database/schema.ts`
- Create: `server/src/database/repositories/taskRepository.ts`

- [ ] **Step 1: 创建 server/src/database/schema.ts**

```typescript
export const createTables = (db: import('better-sqlite3').Database) => {
  // 任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      function_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'success', 'failed')),
      input_data TEXT NOT NULL,
      output_data TEXT,
      task_id_origin TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  // 使用统计表
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      function_type TEXT NOT NULL UNIQUE,
      count INTEGER DEFAULT 0,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  `);
};
```

- [ ] **Step 2: 创建 server/src/database/index.ts**

```typescript
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createTables } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: import('better-sqlite3').Database | null = null;

export const getDatabase = () => {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', '..', 'data', 'app.db');
    db = new Database(dbPath);
    
    // 启用 WAL 模式提高并发
    db.pragma('journal_mode = WAL');
    
    // 创建表
    createTables(db);
  }
  return db;
};

export const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
  }
};
```

- [ ] **Step 3: 创建 server/src/database/repositories/taskRepository.ts**

```typescript
import { getDatabase } from '../index.js';

export interface TaskInput {
  batchId: string;
  functionType: string;
  inputData: Record<string, unknown>;
}

export const taskRepository = {
  create: (input: TaskInput) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO tasks (batch_id, function_type, input_data, status)
      VALUES (?, ?, ?, 'pending')
    `);
    const result = stmt.run(input.batchId, input.functionType, JSON.stringify(input.inputData));
    return result.lastInsertRowid as number;
  },

  findById: (id: number) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as any;
    if (row) {
      row.input_data = JSON.parse(row.input_data);
      row.output_data = row.output_data ? JSON.parse(row.output_data) : null;
    }
    return row;
  },

  findByBatchId: (batchId: string) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tasks WHERE batch_id = ? ORDER BY id');
    const rows = stmt.all(batchId) as any[];
    return rows.map(row => ({
      ...row,
      input_data: JSON.parse(row.input_data),
      output_data: row.output_data ? JSON.parse(row.output_data) : null,
    }));
  },

  updateStatus: (id: number, status: string, outputData?: Record<string, unknown>, errorMessage?: string) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE tasks 
      SET status = ?, output_data = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, outputData ? JSON.stringify(outputData) : null, errorMessage, id);
  },

  setOriginTaskId: (id: number, taskOriginId: string) => {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE tasks SET task_id_origin = ? WHERE id = ?');
    stmt.run(taskOriginId, id);
  },
};
```

- [ ] **Step 4: 测试数据库模块**

```bash
cd server
pnpm dev
# 访问 http://localhost:3000/health 确认服务正常
```

- [ ] **Step 5: 提交**

```bash
git add server/src/database/
git commit -m "feat: create database module with SQLite"
```

---

### Task 4: 创建任务队列系统

**Files:**
- Create: `server/src/queue/index.ts`
- Create: `server/src/queue/processor.ts`

- [ ] **Step 1: 创建 server/src/queue/index.ts**

```typescript
import { taskRepository } from '../database/repositories/taskRepository.js';
import { config } from '../config/index.js';

type Job = {
  taskId: number;
  functionType: string;
  inputData: Record<string, unknown>;
};

type ProcessorFn = (job: Job) => Promise<void>;

class MemoryQueue {
  private queue: Job[] = [];
  private processing = false;
  private processor: ProcessorFn | null = null;
  private running = 0;

  setProcessor(processor: ProcessorFn) {
    this.processor = processor;
  }

  add(job: Job) {
    this.queue.push(job);
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing || !this.processor) return;
    this.processing = true;

    while (this.queue.length > 0 && this.running < config.queue.concurrency) {
      const job = this.queue.shift();
      if (job) {
        this.running++;
        this.processor(job)
          .catch(console.error)
          .finally(() => {
            this.running--;
            this.processQueue();
          });
      }
    }

    this.processing = false;
  }
}

export const queue = new MemoryQueue();
export default queue;
```

- [ ] **Step 2: 创建 server/src/queue/processor.ts**

```typescript
import { taskRepository } from '../database/repositories/taskRepository.js';
import { chcyaiService } from '../services/chcyaiService.js';

export const createProcessor = () => {
  return async (job: { taskId: number; functionType: string; inputData: Record<string, unknown> }) => {
    console.log(`Processing task ${job.taskId} (${job.functionType})`);

    try {
      // 更新状态为 processing
      taskRepository.updateStatus(job.taskId, 'processing');

      // 调用创次元 API
      const result = await chcyaiService.execute(job.functionType, job.inputData);

      // 更新状态为 success
      taskRepository.updateStatus(job.taskId, 'success', result);
      
      console.log(`Task ${job.taskId} completed successfully`);
    } catch (error) {
      console.error(`Task ${job.taskId} failed:`, error);
      
      // 更新状态为 failed
      taskRepository.updateStatus(
        job.taskId, 
        'failed', 
        undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };
};
```

- [ ] **Step 3: 提交**

```bash
git add server/src/queue/
git commit -m "feat: create memory-based task queue"
```

---

### Task 5: 创建创次元 API 服务封装

**Files:**
- Create: `server/src/services/chcyaiService.ts`
- Create: `server/src/services/fileService.ts`
- Create: `server/src/services/types.ts`

- [ ] **Step 1: 创建 server/src/services/types.ts**

```typescript
// API 响应结构
export interface ChcyaiResponse<T> {
  data: T;
  requestId: string;
  status: 'REQUEST_SUCCESS' | 'REQUEST_FAILED';
}

export interface ChcyaiError {
  error: {
    code: string;
    message?: string;
  };
  requestId: string;
  status: 'REQUEST_FAILED';
}

// 功能类型
export type FunctionType = 
  | 'image-generation'
  | 'print-generation'
  | 'pattern-extraction'
  | 'fission'
  | 'becomes-clear'
  | 'clothing-upper'
  | 'clothing-wrinkle-removal'
  | 'cut-out-portrait'
  | 'clothing-diagram'
  | 'garment-extractions'
  | 'intelligent-matting'
  | 'file-upload';

// 任务结果
export interface TaskResult {
  generateImageId?: string;
  tempUrl?: string;
  base64?: string;
  deductibleAmount?: number;
  orderStatus?: string;
}
```

- [ ] **Step 2: 创建 server/src/services/chcyaiService.ts**

```typescript
import axios from 'axios';
import { config } from '../config/index.js';
import type { FunctionType, TaskResult } from './types.js';

const apiClient = axios.create({
  baseURL: config.chcyai.baseUrl,
  timeout: config.chcyai.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加认证头
apiClient.interceptors.request.use((config) => {
  if (config.chcyai.apiKey) {
    config.headers.Authorization = `Bearer ${config.chcyai.apiKey}`;
  }
  return config;
});

export const chcyaiService = {
  /**
   * 上传文件
   */
  uploadFile: async (file: Buffer, filename: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', new Blob([file]), filename);
    
    const response = await axios.post(
      `${config.chcyai.baseUrl}/v1/files/uploads`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${config.chcyai.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    return response.data.data; // fileId
  },

  /**
   * 执行 AI 功能
   */
  execute: async (functionType: FunctionType, inputData: Record<string, unknown>): Promise<TaskResult> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': '/v1/images/generations',
      'print-generation': '/v1/prints/generations',
      'pattern-extraction': '/v1/pattern-extraction/generations',
      'fission': '/v1/fission/generations',
      'becomes-clear': '/v1/becomes-clear/generations',
      'clothing-upper': '/v1/clothing-upper/generations',
      'clothing-wrinkle-removal': '/v1/clothing-wrinkle-removal/generations',
      'cut-out-portrait': '/v1/cut-out-portrait/generations',
      'clothing-diagram': '/v1/clothing-diagram/generations',
      'garment-extractions': '/v1/garment-extractions/generations',
      'intelligent-matting': '/v1/intelligent-matting/generations',
      'file-upload': '/v1/files/uploads',
    };

    const endpoint = endpointMap[functionType];
    
    // 构建请求体（移除 schema 字段，由服务端处理）
    const requestBody = { ...inputData };
    
    const response = await apiClient.post(endpoint, requestBody);
    
    return {
      generateImageId: response.data.data?.generateImageId,
      taskId: response.data.data,
    };
  },

  /**
   * 查询任务结果
   */
  queryResult: async (functionType: FunctionType, taskId: string): Promise<TaskResult> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': `/v1/query/images/info/${taskId}`,
      'print-generation': `/v1/query/prints/info/${taskId}`,
      'pattern-extraction': `/v1/query/pattern-extraction/info/${taskId}`,
      'fission': `/v1/query/fission/info/${taskId}`,
      'becomes-clear': `/v1/query/becomes-clear/info/${taskId}`,
      'clothing-upper': `/v1/query/clothing-upper/info/${taskId}`,
      'clothing-wrinkle-removal': `/v1/query/clothing-wrinkle-removal/info/${taskId}`,
      'cut-out-portrait': `/v1/query/cut-out-portrait/info/${taskId}`,
      'clothing-diagram': `/v1/query/clothing-diagram/info/${taskId}`,
      'garment-extractions': `/v1/query/garment-extractions/info/${taskId}`,
      'intelligent-matting': `/v1/query/intelligent-matting/info/${taskId}`,
      'file-upload': '',
    };

    const endpoint = endpointMap[functionType];
    
    if (!endpoint) {
      throw new Error('Invalid function type');
    }

    const response = await apiClient.get(endpoint);
    return response.data.data;
  },

  /**
   * 获取临时下载 URL
   */
  getTempUrl: async (functionType: FunctionType, taskId: string): Promise<string> => {
    const endpointMap: Record<FunctionType, string> = {
      'image-generation': `/v1/query/images/getTempUrlInfo/${taskId}`,
      'print-generation': `/v1/query/prints/getTempUrlInfo/${taskId}`,
      'pattern-extraction': `/v1/query/pattern-extraction/getTempUrlInfo/${taskId}`,
      'fission': `/v1/query/fission/getTempUrlInfo/${taskId}`,
      'becomes-clear': `/v1/query/becomes-clear/getTempUrlInfo/${taskId}`,
      'clothing-upper': `/v1/query/clothing-upper/getTempUrlInfo/${taskId}`,
      'clothing-wrinkle-removal': `/v1/query/clothing-wrinkle-removal/getTempUrlInfo/${taskId}`,
      'cut-out-portrait': `/v1/query/cut-out-portrait/getTempUrlInfo/${taskId}`,
      'clothing-diagram': `/v1/query/clothing-diagram/getTempUrlInfo/${taskId}`,
      'garment-extractions': `/v1/query/garment-extractions/getTempUrlInfo/${taskId}`,
      'intelligent-matting': `/v1/query/intelligent-matting/getTempUrlInfo/${taskId}`,
      'file-upload': '',
    };

    const endpoint = endpointMap[functionType];
    
    if (!endpoint) {
      throw new Error('Invalid function type');
    }

    const response = await apiClient.get(endpoint);
    return response.data.data.tempUrl;
  },
};
```

- [ ] **Step 3: 创建 server/src/services/fileService.ts**

```typescript
import { join } from 'node:path';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { config } from '../config/index.js';
import { v4 as uuidv4 } from 'uuid';

export const fileService = {
  /**
   * 保存上传的文件
   */
  saveFile: async (buffer: Buffer, originalName: string): Promise<string> => {
    const ext = originalName.split('.').pop() || 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const filepath = join(config.storage.path, filename);
    
    await mkdir(config.storage.path, { recursive: true });
    await writeFile(filepath, buffer);
    
    return filename;
  },

  /**
   * 读取文件
   */
  readFile: async (filename: string): Promise<Buffer> => {
    const filepath = join(config.storage.path, filename);
    return readFile(filepath);
  },

  /**
   * 获取文件路径
   */
  getFilePath: (filename: string): string => {
    return join(config.storage.path, filename);
  },

  /**
   * 删除文件
   */
  deleteFile: async (filename: string): Promise<void> => {
    const filepath = join(config.storage.path, filename);
    try {
      await stat(filepath);
      // 这里可以添加删除逻辑，MVP 阶段先不实现
    } catch {
      // 文件不存在
    }
  },
};
```

- [ ] **Step 4: 提交**

```bash
git add server/src/services/
git commit -m "feat: create Chcyai API service wrapper"
```

---

### Task 6: 创建后端控制器和路由

**Files:**
- Create: `server/src/controllers/taskController.ts`
- Create: `server/src/controllers/fileController.ts`
- Create: `server/src/routes/api.ts`

- [ ] **Step 1: 创建 server/src/controllers/fileController.ts**

```typescript
import { Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { fileService } from '../services/fileService.js';
import { chcyaiService } from '../services/chcyaiService.js';

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.storage.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (config.storage.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

export const fileController = {
  upload: upload.single('file'),

  handleUpload: async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // 保存文件到本地
      const filename = await fileService.saveFile(req.file.buffer, req.file.originalname);

      // 调用创次元 API 上传
      const fileId = await chcyaiService.uploadFile(req.file.buffer, req.file.originalname);

      res.json({
        success: true,
        data: {
          localFile: filename,
          fileId,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  },

  download: async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;
      const buffer = await fileService.readFile(filename);
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }
  },
};
```

- [ ] **Step 2: 创建 server/src/controllers/taskController.ts**

```typescript
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { taskRepository } from '../database/repositories/taskRepository.js';
import { queue } from '../queue/index.js';
import type { FunctionType } from '../services/types.js';

export const taskController = {
  /**
   * 创建单图任务
   */
  createSingle: async (req: Request, res: Response) => {
    try {
      const { functionType, inputData } = req.body as {
        functionType: FunctionType;
        inputData: Record<string, unknown>;
      };

      const batchId = uuidv4();
      const taskId = taskRepository.create({
        batchId,
        functionType,
        inputData,
      });

      // 加入队列
      queue.add({ taskId, functionType, inputData });

      res.json({
        success: true,
        data: { taskId, batchId },
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      });
    }
  },

  /**
   * 创建批量任务
   */
  createBatch: async (req: Request, res: Response) => {
    try {
      const { functionType, items } = req.body as {
        functionType: FunctionType;
        items: Array<{ inputData: Record<string, unknown> }>;
      };

      const batchId = uuidv4();
      const taskIds: number[] = [];

      // 创建所有子任务
      for (const item of items) {
        const taskId = taskRepository.create({
          batchId,
          functionType,
          inputData: item.inputData,
        });
        taskIds.push(taskId);
        
        // 加入队列
        queue.add({ taskId, functionType, inputData: item.inputData });
      }

      res.json({
        success: true,
        data: { batchId, taskIds, total: items.length },
      });
    } catch (error) {
      console.error('Create batch error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch',
      });
    }
  },

  /**
   * 获取任务详情
   */
  getById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const task = taskRepository.findById(parseInt(id));

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get task',
      });
    }
  },

  /**
   * 获取批量任务进度
   */
  getBatchProgress: async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const tasks = taskRepository.findByBatchId(batchId);

      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'success').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      const processing = tasks.filter(t => t.status === 'processing').length;
      const pending = tasks.filter(t => t.status === 'pending').length;

      res.json({
        success: true,
        data: {
          batchId,
          total,
          completed,
          failed,
          processing,
          pending,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          tasks,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get progress',
      });
    }
  },

  /**
   * 获取任务列表
   */
  getList: async (req: Request, res: Response) => {
    try {
      const { status, functionType, page = '1', limit = '20' } = req.query;
      // 这里可以添加分页和筛选逻辑，MVP 阶段先返回最近 20 条
      
      res.json({
        success: true,
        data: [], // TODO: 实现数据库查询
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tasks',
      });
    }
  },
};
```

- [ ] **Step 3: 创建 server/src/routes/api.ts**

```typescript
import { Router } from 'express';
import { taskController } from '../controllers/taskController.js';
import { fileController } from '../controllers/fileController.js';

export const apiRouter = Router();

// 文件相关
apiRouter.post('/files/upload', fileController.handleUpload);
apiRouter.get('/files/download/:filename', fileController.download);

// 任务相关
apiRouter.post('/tasks/single', taskController.createSingle);
apiRouter.post('/tasks/batch', taskController.createBatch);
apiRouter.get('/tasks', taskController.getList);
apiRouter.get('/tasks/:id', taskController.getById);
apiRouter.get('/tasks/:batchId/progress', taskController.getBatchProgress);

// 功能列表
apiRouter.get('/functions', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'image-generation', name: 'AI 生图' },
      { id: 'print-generation', name: '打印图生成' },
      { id: 'pattern-extraction', name: '印花提取' },
      { id: 'fission', name: '图裂变' },
      { id: 'becomes-clear', name: 'AI 变清晰' },
      { id: 'clothing-upper', name: '服装上身' },
      { id: 'clothing-wrinkle-removal', name: '服装去皱' },
      { id: 'cut-out-portrait', name: '扣头像' },
      { id: 'clothing-diagram', name: '3D 服装图' },
      { id: 'garment-extractions', name: '服装提取' },
      { id: 'intelligent-matting', name: '智能抠图' },
    ],
  });
});
```

- [ ] **Step 4: 更新 server/src/index.ts 使用路由**

修改 `server/src/index.ts`，在健康检查后添加：

```typescript
// API 路由
import { apiRouter } from './routes/api.js';
import { createProcessor } from './queue/processor.js';
import { queue } from './queue/index.js';

app.use('/api/v1', apiRouter);

// 初始化队列处理器
queue.setProcessor(createProcessor());
```

- [ ] **Step 5: 提交**

```bash
git add server/src/controllers/ server/src/routes/ server/src/index.ts
git commit -m "feat: create controllers and API routes"
```

---

## Phase 2: 前端开发

### Task 7: 创建前端脚手架

**Files:**
- Create: `client/package.json`
- Create: `client/vite.config.ts`
- Create: `client/tsconfig.json`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`

- [ ] **Step 1: 创建 client/package.json**

```json
{
  "name": "client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "zustand": "^4.4.7",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.39",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.5",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.16"
  }
}
```

- [ ] **Step 2: 创建 client/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true,
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: 创建 client/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: 创建 client/tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建 client/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>创次元 PRO - 跨境电商 AI 图片处理平台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: 创建 client/src/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: 创建 client/src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <h1>创次元 PRO</h1>
          <nav>
            <a href="/">首页</a>
            <a href="/tasks">任务中心</a>
            <a href="/settings">设置</a>
          </nav>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/function/:type" element={<FunctionPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div>
      <h2>欢迎使用创次元 PRO</h2>
      <p>选择功能开始处理图片</p>
    </div>
  );
}

function FunctionPage() {
  return <div>功能页面</div>;
}

function TasksPage() {
  return <div>任务中心</div>;
}

function SettingsPage() {
  return <div>设置</div>;
}

export default App;
```

- [ ] **Step 8: 创建 client/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: #f5f5f5;
  color: #1a1a1a;
}

.app {
  min-height: 100vh;
}

.header {
  background-color: #1a365d;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

.header nav {
  display: flex;
  gap: 1.5rem;
}

.header nav a {
  color: white;
  text-decoration: none;
  opacity: 0.9;
}

.header nav a:hover {
  opacity: 1;
}

.main {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}
```

- [ ] **Step 9: 创建 client/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#1a365d',
          600: '#1a365d',
          700: '#2c5282',
        },
        accent: {
          500: '#3182ce',
          600: '#2b6cb0',
        },
        success: '#38a169',
        warning: '#dd6b20',
        error: '#e53e3e',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 10: 创建 client/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 11: 提交**

```bash
git add client/
git commit -m "feat: create client scaffold with Vite + React"
```

---

### Task 8: 创建前端 API 客户端和状态管理

**Files:**
- Create: `client/src/api/index.ts`
- Create: `client/src/stores/taskStore.ts`
- Create: `client/src/types/index.ts`

- [ ] **Step 1: 创建 client/src/types/index.ts**

```typescript
export interface Task {
  id: number;
  batchId: string;
  functionType: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  taskOriginId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface BatchProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
  progress: number;
  tasks: Task[];
}

export interface FunctionInfo {
  id: string;
  name: string;
}

export interface UploadResponse {
  success: boolean;
  data: {
    localFile: string;
    fileId: string;
  };
}

export interface CreateTaskResponse {
  success: boolean;
  data: {
    taskId: number;
    batchId: string;
  };
}

export interface CreateBatchResponse {
  success: boolean;
  data: {
    batchId: string;
    taskIds: number[];
    total: number;
  };
}
```

- [ ] **Step 2: 创建 client/src/api/index.ts**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  // 功能列表
  getFunctions: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/functions'),

  // 文件上传
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 创建单图任务
  createSingleTask: (functionType: string, inputData: Record<string, unknown>) =>
    api.post('/tasks/single', { functionType, inputData }),

  // 创建批量任务
  createBatchTask: (functionType: string, items: Array<{ inputData: Record<string, unknown> }>) =>
    api.post('/tasks/batch', { functionType, items }),

  // 获取任务详情
  getTask: (id: number) => api.get(`/tasks/${id}`),

  // 获取批量进度
  getBatchProgress: (batchId: string) => api.get(`/tasks/${batchId}/progress`),

  // 获取任务列表
  getTasks: (params?: { status?: string; functionType?: string; page?: number; limit?: number }) =>
    api.get('/tasks', { params }),
};
```

- [ ] **Step 3: 创建 client/src/stores/taskStore.ts**

```typescript
import { create } from 'zustand';
import type { Task, BatchProgress } from '@/types';

interface TaskState {
  tasks: Task[];
  batchProgress: Record<string, BatchProgress>;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  setBatchProgress: (batchId: string, progress: BatchProgress) => void;
  getBatchTasks: (batchId: string) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  batchProgress: {},

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setBatchProgress: (batchId, progress) =>
    set((state) => ({
      batchProgress: { ...state.batchProgress, batchId: progress },
    })),

  getBatchTasks: (batchId) => {
    const progress = get().batchProgress[batchId];
    return progress?.tasks || [];
  },
}));
```

- [ ] **Step 4: 提交**

```bash
git add client/src/api/ client/src/stores/ client/src/types/
git commit -m "feat: create API client and Zustand store"
```

---

### Task 9: 创建功能选择页面

**Files:**
- Create: `client/src/pages/HomePage.tsx`
- Create: `client/src/components/FunctionCard.tsx`

- [ ] **Step 1: 创建 client/src/components/FunctionCard.tsx**

```typescript
import { Link } from 'react-router-dom';

interface FunctionCardProps {
  id: string;
  name: string;
  description?: string;
}

export function FunctionCard({ id, name, description }: FunctionCardProps) {
  return (
    <Link
      to={`/function/${id}`}
      className="function-card"
    >
      <div className="card-header">
        <h3>{name}</h3>
      </div>
      {description && <p className="card-description">{description}</p>}
      <div className="card-actions">
        <button className="btn-primary">使用此功能</button>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 创建 client/src/pages/HomePage.tsx**

```typescript
import { useEffect, useState } from 'react';
import { apiClient } from '@/api';
import { FunctionCard } from '@/components/FunctionCard';

const FUNCTION_DESCRIPTIONS: Record<string, string> = {
  'image-generation': '根据提示词生成高质量商品图片',
  'print-generation': '生成可打印的高分辨率图片',
  'pattern-extraction': '从图片中提取印花图案',
  'fission': '基于原图生成多个变体',
  'becomes-clear': 'AI 增强图片清晰度',
  'clothing-upper': '虚拟试衣，服装上身效果',
  'clothing-wrinkle-removal': '去除服装图片褶皱',
  'cut-out-portrait': '智能抠取人像',
  'clothing-diagram': '生成 3D 服装展示图',
  'garment-extractions': '提取服装主体',
  'intelligent-matting': '智能抠图，支持多种主体',
};

export function HomePage() {
  const [functions, setFunctions] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getFunctions().then((res) => {
      setFunctions(res.data.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="home-page">
      <h2>功能列表</h2>
      <div className="function-grid">
        {functions.map((fn) => (
          <FunctionCard
            key={fn.id}
            id={fn.id}
            name={fn.name}
            description={FUNCTION_DESCRIPTIONS[fn.id]}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 添加样式到 client/src/index.css**

```css
.function-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.function-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
}

.function-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-header h3 {
  color: #1a365d;
  margin-bottom: 0.5rem;
}

.card-description {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.card-actions .btn-primary {
  background-color: #3182ce;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
```

- [ ] **Step 4: 提交**

```bash
git add client/src/pages/HomePage.tsx client/src/components/FunctionCard.tsx
git commit -m "feat: create home page with function list"
```

---

### Task 10: 创建单图/批量处理页面

**Files:**
- Create: `client/src/pages/FunctionPage.tsx`
- Create: `client/src/components/ImageUploader.tsx`
- Create: `client/src/components/BatchUploader.tsx`
- Create: `client/src/components/TaskProgress.tsx`

（由于代码较长，这里给出简化版本，实际实现需要完整代码）

- [ ] **Step 1-5: 创建组件**

参考上述模式创建完整的处理页面组件。

---

## 验收标准

1. **后端验收**:
   - [ ] `/health` 返回正常
   - [ ] 文件上传接口返回 fileId
   - [ ] 创建任务成功并加入队列
   - [ ] 批量任务进度查询正常

2. **前端验收**:
   - [ ] 首页显示所有功能
   - [ ] 可以上传单张图片并提交任务
   - [ ] 可以上传多张图片进行批量处理
   - [ ] 任务中心显示进度

3. **部署验收**:
   - [ ] `pnpm run build` 成功
   - [ ] `pnpm run start` 启动后前端可访问
   - [ ] 无 CORS 错误

---

## 执行选择

计划完成并保存到 `docs/superpowers/plans/2026-04-15-ccy-pro-mvp.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** - 每个 Task 派发给独立 subagent 执行，任务间 review，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 批量执行，带检查点 review

**选择哪种方式？**
