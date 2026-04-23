import { query, exec, lastInsertRowid } from '../database/index.js';

export interface Team {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  api_key: string | null;
  created_at: string;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  user_email?: string;
  user_nickname?: string;
}

/**
 * 获取团队信息
 */
export const getTeamById = (teamId: number): Team | null => {
  const teams = query('SELECT * FROM teams WHERE id = ?', [teamId]) as Team[];
  return teams.length > 0 ? teams[0] : null;
};

/**
 * 获取用户的所有团队
 */
export const getUserTeams = (userId: number): Team[] => {
  return query(`
    SELECT t.*, tm.role as member_role
    FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ?
  `, [userId]) as Team[];
};

/**
 * 获取所有团队（平台管理员用）
 */
export const getAllTeams = (): Team[] => {
  return query(`
    SELECT t.*, 'admin' as member_role
    FROM teams t
    ORDER BY t.created_at DESC
  `) as Team[];
};

/**
 * 获取团队成员列表
 */
export const getTeamMembers = (teamId: number): TeamMember[] => {
  return query(`
    SELECT tm.*, u.email as user_email, u.nickname as user_nickname
    FROM team_members tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.team_id = ?
  `, [teamId]) as TeamMember[];
};

/**
 * 移除团队成员
 */
export const removeTeamMember = (teamId: number, userId: number): void => {
  // 不允许移除团队 owner
  const team = getTeamById(teamId);
  if (team && team.owner_id === userId) {
    throw new Error('不能移除团队创建者');
  }

  exec('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);

  // 同时更新用户的 team_id 为 NULL
  exec('UPDATE users SET team_id = NULL WHERE id = ?', [userId]);
};

/**
 * 设置团队 API Key
 */
export const setTeamApiKey = (teamId: number, apiKey: string, userId: number): void => {
  // 验证用户是否是该团队的管理员
  const user = query(
    'SELECT team_id, is_team_admin FROM users WHERE id = ?',
    [userId]
  )[0] as { team_id: number | null; is_team_admin: boolean };

  if (!user || !user.is_team_admin || user.team_id !== teamId) {
    throw new Error('无权设置该团队的 API Key');
  }

  exec(`
    UPDATE teams SET api_key = ? WHERE id = ?
  `, [apiKey, teamId]);
};

/**
 * 获取团队 API Key（脱敏）
 */
export const getTeamApiKey = (teamId: number, userId: number): string | null => {
  // 验证用户是否是该团队的成员
  const isMember = query(
    'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?',
    [teamId, userId]
  ).length > 0;

  if (!isMember) {
    throw new Error('无权查看该团队的 API Key');
  }

  const team = getTeamById(teamId);
  if (!team || !team.api_key) {
    return null;
  }

  // 脱敏显示：只显示前 8 位和后 4 位
  const key = team.api_key;
  if (key.length <= 12) {
    return key.substring(0, 4) + '****';
  }
  return key.substring(0, 8) + '****' + key.substring(key.length - 4);
};

/**
 * 获取团队 API Key（完整，仅管理员）
 */
export const getTeamApiKeyFull = (teamId: number, userId: number): string | null => {
  // 验证用户是否是该团队的管理员
  const user = query(
    'SELECT team_id, is_team_admin FROM users WHERE id = ?',
    [userId]
  )[0] as { team_id: number | null; is_team_admin: boolean };

  if (!user || !user.is_team_admin || user.team_id !== teamId) {
    throw new Error('只有团队管理员可以查看完整 API Key');
  }

  const team = getTeamById(teamId);
  return team?.api_key || null;
};

/**
 * 获取团队 API Key 原始值（内部使用，无权限校验）
 */
export const getTeamApiKeyValue = (teamId: number): string | null => {
  const teams = query('SELECT api_key FROM teams WHERE id = ?', [teamId]) as Array<{ api_key: string | null }>;
  return teams.length > 0 ? teams[0].api_key : null;
};

/**
 * 检查用户是否是团队成员
 */
export const isTeamMember = (userId: number, teamId: number): boolean => {
  const result = query('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?', [teamId, userId]);
  return result.length > 0;
};

/**
 * 检查用户是否是团队管理员
 */
export const isTeamAdmin = (userId: number, teamId: number): boolean => {
  const result = query(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?',
    [teamId, userId]
  )[0] as { role: string } | undefined;
  return result?.role === 'admin';
};

/**
 * 获取团队 owner
 */
export const getTeamOwner = (teamId: number): number | null => {
  const teams = query('SELECT owner_id FROM teams WHERE id = ?', [teamId]) as Array<{ owner_id: number }>;
  return teams.length > 0 ? teams[0].owner_id : null;
};
