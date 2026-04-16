import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, exec, lastInsertRowid } from '../database/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'chcyai-pro-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  nickname: string | null;
  avatar_url: string | null;
  role: 'super_admin' | 'member';
  team_id: number | null;
  is_team_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
  role: string;
  teamId?: number;
}

export interface TokenResult {
  token: string;
  user: Omit<User, 'password_hash'>;
}

/**
 * 密码加密
 */
export const hashPassword = async (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
};

/**
 * 验证密码
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

/**
 * 生成 JWT Token
 */
export const generateToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * 验证 JWT Token
 */
export const verifyToken = (token: string): AuthPayload => {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
};

/**
 * 团队管理员注册 - 自动创建团队
 */
export const register = async (
  email: string,
  password: string,
  teamName: string,
  nickname?: string
): Promise<TokenResult> => {
  // 检查邮箱是否已存在
  const existing = query('SELECT id FROM users WHERE email = ?', [email]) as Array<{ id: number }>;
  if (existing.length > 0) {
    throw new Error('邮箱已被注册');
  }

  const passwordHash = await hashPassword(password);
  const defaultNickname = nickname || email.split('@')[0];

  // 1. 创建用户（暂不关联团队）
  exec(`
    INSERT INTO users (email, password_hash, nickname, role, is_team_admin)
    VALUES (?, ?, ?, 'member', 1)
  `, [email, passwordHash, defaultNickname]);

  const userId = lastInsertRowid();

  // 2. 创建团队，owner_id 指向该用户
  exec(`
    INSERT INTO teams (name, description, owner_id)
    VALUES (?, ?, ?)
  `, [teamName, `${defaultNickname}的团队`, userId]);

  const teamId = lastInsertRowid();

  // 3. 更新用户，关联团队
  exec(`
    UPDATE users SET team_id = ? WHERE id = ?
  `, [teamId, userId]);

  // 4. 添加团队成员关系
  exec(`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (?, ?, 'admin')
  `, [teamId, userId]);

  // 5. 生成 token
  const token = generateToken({
    userId,
    email,
    role: 'member',
    teamId,
  });

  // 6. 获取用户信息
  const user = query(
    'SELECT id, email, nickname, avatar_url, role, team_id, is_team_admin, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  )[0] as Omit<User, 'password_hash'>;

  return { token, user };
};

/**
 * 团队管理员创建成员账号
 */
export const createMemberByAdmin = async (
  adminId: number,
  email: string,
  password: string,
  nickname?: string
): Promise<Omit<User, 'password_hash'>> => {
  // 1. 获取管理员信息
  const admins = query(
    'SELECT team_id, is_team_admin FROM users WHERE id = ?',
    [adminId]
  ) as Array<{ team_id: number | null; is_team_admin: boolean }>;

  if (admins.length === 0) {
    throw new Error('管理员不存在');
  }

  const admin = admins[0];
  if (!admin.team_id || !admin.is_team_admin) {
    throw new Error('无权创建成员');
  }

  // 2. 检查邮箱是否已存在
  const existing = query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new Error('邮箱已被注册');
  }

  const passwordHash = await hashPassword(password);
  const defaultNickname = nickname || email.split('@')[0];

  // 3. 创建成员，直接关联到管理员所在团队
  exec(`
    INSERT INTO users (email, password_hash, nickname, role, team_id, is_team_admin)
    VALUES (?, ?, ?, 'member', ?, 0)
  `, [email, passwordHash, defaultNickname, admin.team_id]);

  const memberId = lastInsertRowid();

  // 4. 添加团队成员关系
  exec(`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (?, ?, 'member')
  `, [admin.team_id, memberId]);

  // 5. 获取成员信息
  const member = query(
    'SELECT id, email, nickname, avatar_url, role, team_id, is_team_admin, created_at, updated_at FROM users WHERE id = ?',
    [memberId]
  )[0] as Omit<User, 'password_hash'>;

  return member;
};

/**
 * 用户登录
 */
export const login = async (email: string, password: string): Promise<TokenResult> => {
  // 查找用户
  const users = query('SELECT * FROM users WHERE email = ?', [email]) as User[];
  if (users.length === 0) {
    throw new Error('邮箱或密码错误');
  }

  const user = users[0];

  // 验证密码
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('邮箱或密码错误');
  }

  // 生成 token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    teamId: user.team_id || undefined,
  });

  // 返回用户信息（不包含密码）
  const userInfo: Omit<User, 'password_hash'> = {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    role: user.role,
    team_id: user.team_id,
    is_team_admin: user.is_team_admin,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };

  return { token, user: userInfo };
};

/**
 * 获取用户信息
 */
export const getUserById = (userId: number): Omit<User, 'password_hash'> | null => {
  const users = query(
    'SELECT id, email, nickname, avatar_url, role, team_id, is_team_admin, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  ) as Omit<User, 'password_hash'>[];
  return users.length > 0 ? users[0] : null;
};

/**
 * 获取用户所在团队
 */
export const getUserTeams = (userId: number) => {
  return query(`
    SELECT t.*, tm.role as member_role
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `, [userId]);
};

/**
 * 获取用户额度
 */
export const getUserBalance = (userId: number, teamId?: number) => {
  if (teamId) {
    const allocations = query(`
      SELECT amount - used_amount as balance
      FROM budget_allocations
      WHERE user_id = ? AND team_id = ?
    `, [userId, teamId]) as Array<{ balance: number }>;
    return allocations.length > 0 ? allocations[0].balance : 0;
  }

  const result = query(`
    SELECT SUM(amount - used_amount) as total_balance
    FROM budget_allocations
    WHERE user_id = ?
  `, [userId]) as Array<{ total_balance: number }>;

  return result[0]?.total_balance || 0;
};

/**
 * 检查用户是否是团队管理员
 */
export const isTeamAdmin = (userId: number): boolean => {
  const users = query(
    'SELECT is_team_admin, team_id FROM users WHERE id = ?',
    [userId]
  ) as Array<{ is_team_admin: boolean; team_id: number | null }>;

  if (users.length === 0) return false;
  return users[0].is_team_admin && users[0].team_id !== null;
};

/**
 * 获取用户所在团队 ID
 */
export const getUserTeamId = (userId: number): number | null => {
  const users = query(
    'SELECT team_id FROM users WHERE id = ?',
    [userId]
  ) as Array<{ team_id: number | null }>;

  return users.length > 0 ? users[0].team_id : null;
};
