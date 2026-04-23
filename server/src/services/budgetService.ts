import { query, exec, lastInsertRowid } from '../database/index.js';
import { isTeamMember } from './teamService.js';

export interface Budget {
  id: number;
  team_id: number;
  amount: number;
  used_amount: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetAllocation {
  id: number;
  team_id: number;
  user_id: number;
  amount: number;
  used_amount: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  type: 'recharge' | 'allocate' | 'consume' | 'refund';
  amount: number;
  team_id: number | null;
  user_id: number | null;
  task_id: number | null;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

/**
 * 平台管理员给团队充值预算
 */
export const rechargeBudget = (teamId: number, amount: number, createdBy: number): number => {
  // 检查团队是否已有预算记录
  const existing = query('SELECT id, amount, used_amount FROM budgets WHERE team_id = ?', [teamId]) as Array<{ id: number; amount: number; used_amount: number }>;

  let budgetId: number;
  if (existing.length > 0) {
    // 更新现有预算
    exec(`
      UPDATE budgets SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ?
    `, [amount, teamId]);
    budgetId = existing[0].id;
  } else {
    // 创建新预算
    exec(`
      INSERT INTO budgets (team_id, amount, used_amount, created_by)
      VALUES (?, ?, 0, ?)
    `, [teamId, amount, createdBy]);
    budgetId = lastInsertRowid();
  }

  // 记录交易流水
  exec(`
    INSERT INTO transactions (type, amount, team_id, description, created_by)
    VALUES ('recharge', ?, ?, '平台充值', ?)
  `, [amount, teamId, createdBy]);

  // 自动将充值额度分配给团队管理员
  const team = query('SELECT owner_id FROM teams WHERE id = ?', [teamId]) as Array<{ owner_id: number }>;
  if (team.length > 0) {
    const ownerId = team[0].owner_id;
    const existingAlloc = query('SELECT id FROM budget_allocations WHERE team_id = ? AND user_id = ?', [teamId, ownerId]);
    if (existingAlloc.length > 0) {
      exec(`
        UPDATE budget_allocations SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP
        WHERE team_id = ? AND user_id = ?
      `, [amount, teamId, ownerId]);
    } else {
      exec(`
        INSERT INTO budget_allocations (team_id, user_id, amount, used_amount, created_by)
        VALUES (?, ?, ?, 0, ?)
      `, [teamId, ownerId, amount, createdBy]);
    }

    // 更新团队已用额度（分配出去的部分）
    exec(`
      UPDATE budgets SET used_amount = used_amount + ?, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ?
    `, [amount, teamId]);

    // 记录分配流水
    exec(`
      INSERT INTO transactions (type, amount, team_id, user_id, description, created_by)
      VALUES ('allocate', ?, ?, ?, '充值自动分配给管理员', ?)
    `, [amount, teamId, ownerId, createdBy]);
  }

  return budgetId;
};

/**
 * 团队管理员自行设定总额度（用于绑了自己 Key 的团队，对标创次元充值量）
 * 设定后自动全部分配给管理员
 */
export const setTeamTotalBudget = (teamId: number, totalAmount: number, createdBy: number): number => {
  const existing = query('SELECT id, used_amount FROM budgets WHERE team_id = ?', [teamId]) as Array<{ id: number; used_amount: number }>;

  let budgetId: number;
  if (existing.length > 0) {
    exec(`
      UPDATE budgets SET amount = ?, used_amount = 0, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ?
    `, [totalAmount, teamId]);
    budgetId = existing[0].id;
  } else {
    exec(`
      INSERT INTO budgets (team_id, amount, used_amount, created_by)
      VALUES (?, ?, 0, ?)
    `, [teamId, totalAmount, createdBy]);
    budgetId = lastInsertRowid();
  }

  // 清除旧的分配记录，重新分配给管理员
  const usedByOthers = query(`
    SELECT COALESCE(SUM(amount - used_amount), 0) as locked
    FROM budget_allocations
    WHERE team_id = ? AND user_id != ?
  `, [teamId, createdBy])[0] as { locked: number };

  const adminAmount = totalAmount - (usedByOthers?.locked || 0);

  const existingAlloc = query('SELECT id FROM budget_allocations WHERE team_id = ? AND user_id = ?', [teamId, createdBy]);
  if (existingAlloc.length > 0) {
    exec(`
      UPDATE budget_allocations SET amount = ?, used_amount = 0, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ? AND user_id = ?
    `, [adminAmount, teamId, createdBy]);
  } else {
    exec(`
      INSERT INTO budget_allocations (team_id, user_id, amount, used_amount, created_by)
      VALUES (?, ?, ?, 0, ?)
    `, [teamId, createdBy, adminAmount, createdBy]);
  }

  // 更新团队已用额度 = 其他成员已分配的额度
  exec(`
    UPDATE budgets SET used_amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE team_id = ?
  `, [usedByOthers?.locked || 0, teamId]);

  // 记录流水
  exec(`
    INSERT INTO transactions (type, amount, team_id, description, created_by)
    VALUES ('recharge', ?, ?, '管理员设定总额度', ?)
  `, [totalAmount, teamId, createdBy]);

  return budgetId;
};

/**
 * 团队管理员分配额度给成员
 */
export const allocateBudget = (teamId: number, userId: number, amount: number, createdBy: number): number => {
  if (!isTeamMember(userId, teamId)) {
    throw new Error('只能给团队成员分配额度');
  }

  // 检查团队预算是否充足
  const teamBudget = query('SELECT amount - used_amount as available FROM budgets WHERE team_id = ?', [teamId])[0] as { available: number } | undefined;
  if (!teamBudget || teamBudget.available < amount) {
    throw new Error('团队预算不足');
  }

  // 检查是否已有分配记录
  const existing = query('SELECT id FROM budget_allocations WHERE team_id = ? AND user_id = ?', [teamId, userId]);

  if (existing.length > 0) {
    // 更新现有分配
    exec(`
      UPDATE budget_allocations SET amount = amount + ?, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ? AND user_id = ?
    `, [amount, teamId, userId]);
  } else {
    // 创建新分配
    exec(`
      INSERT INTO budget_allocations (team_id, user_id, amount, used_amount, created_by)
      VALUES (?, ?, ?, 0, ?)
    `, [teamId, userId, amount, createdBy]);
  }

  // 更新团队已用额度
  exec(`
    UPDATE budgets SET used_amount = used_amount + ?, updated_at = CURRENT_TIMESTAMP
    WHERE team_id = ?
  `, [amount, teamId]);

  // 记录交易流水
  exec(`
    INSERT INTO transactions (type, amount, team_id, user_id, description, created_by)
    VALUES ('allocate', ?, ?, ?, '额度分配', ?)
  `, [amount, teamId, userId, createdBy]);

  return lastInsertRowid();
};

/**
 * 消耗额度（任务执行时调用）
 */
export const consumeBudget = (teamId: number, userId: number, amount: number, taskId: number): void => {
  // 检查个人额度是否充足
  const userBudget = query(`
    SELECT amount - used_amount as available
    FROM budget_allocations
    WHERE team_id = ? AND user_id = ?
  `, [teamId, userId])[0] as { available: number } | undefined;

  if (!userBudget || userBudget.available < amount) {
    throw new Error('个人额度不足，请联系管理员充值');
  }

  // 更新个人已用额度
  exec(`
    UPDATE budget_allocations SET used_amount = used_amount + ?, updated_at = CURRENT_TIMESTAMP
    WHERE team_id = ? AND user_id = ?
  `, [amount, teamId, userId]);

  // 记录交易流水
  exec(`
    INSERT INTO transactions (type, amount, team_id, user_id, task_id, description)
    VALUES ('consume', ?, ?, ?, ?, '任务执行')
  `, [amount, teamId, userId, taskId]);

  // 更新任务成本
  exec(`
    UPDATE tasks SET cost = ? WHERE id = ?
  `, [amount, taskId]);
};

/**
 * 获取团队预算
 */
export const getTeamBudget = (teamId: number): { amount: number; used_amount: number; available: number } | null => {
  const budgets = query(`
    SELECT amount, used_amount, amount - used_amount as available
    FROM budgets
    WHERE team_id = ?
  `, [teamId])[0] as { amount: number; used_amount: number; available: number } | undefined;

  return budgets || null;
};

/**
 * 获取用户额度
 */
export const getUserBudget = (userId: number, teamId: number): { amount: number; used_amount: number; available: number } | null => {
  const allocations = query(`
    SELECT amount, used_amount, amount - used_amount as available
    FROM budget_allocations
    WHERE team_id = ? AND user_id = ?
  `, [teamId, userId])[0] as { amount: number; used_amount: number; available: number } | undefined;

  return allocations || null;
};

/**
 * 获取交易流水
 */
export const getTransactions = (filters: { teamId?: number; userId?: number; type?: string; limit?: number; offset?: number }): Transaction[] => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.teamId) {
    conditions.push('team_id = ?');
    params.push(filters.teamId);
  }
  if (filters.userId) {
    conditions.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = filters.limit ? `LIMIT ? OFFSET ?` : '';
  if (filters.limit) {
    params.push(filters.limit);
    params.push(filters.offset || 0);
  }

  return query(`
    SELECT * FROM transactions
    ${whereClause}
    ORDER BY created_at DESC
    ${limitClause}
  `, params) as Transaction[];
};

/**
 * 获取团队使用统计
 */
export const getTeamUsageStats = (teamId: number) => {
  return query(`
    SELECT function_type, COUNT(*) as count, SUM(total_cost) as total_cost
    FROM usage_stats
    WHERE team_id = ?
    GROUP BY function_type
  `, [teamId]);
};
