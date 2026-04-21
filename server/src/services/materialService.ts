import { exec, lastInsertRowid, query } from '../database/index.js';
import { getUserTeams, isTeamMember } from './teamService.js';

export interface MaterialAsset {
  id: number;
  user_id: number;
  team_id: number;
  file_id: string;
  local_file: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  source_type: 'upload' | 'generated';
  task_id?: number | null;
  workflow_run_id?: number | null;
  result_url?: string | null;
  image_width?: number | null;
  image_height?: number | null;
  tags_json?: string | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  user_email?: string | null;
  user_nickname?: string | null;
  team_name?: string | null;
}

interface CreateMaterialInput {
  userId: number;
  teamId: number;
  fileId: string;
  localFile: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sourceType?: 'upload' | 'generated';
  taskId?: number;
  workflowRunId?: number;
  resultUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export const createMaterial = (input: CreateMaterialInput): MaterialAsset => {
  // 先检查 fileId 是否已存在
  const existing = query(
    `SELECT id FROM materials WHERE file_id = ?`,
    [input.fileId]
  ) as Array<{ id: number }>;

  if (existing.length > 0) {
    // 文件已存在，返回现有记录
    return getMaterialById(existing[0].id)!;
  }

  // 文件不存在，插入新记录
  exec(
    `
      INSERT INTO materials (
        user_id, team_id, file_id, local_file, original_name, mime_type, size_bytes, source_type, task_id, workflow_run_id, result_url, image_width, image_height
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.userId,
      input.teamId,
      input.fileId,
      input.localFile,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.sourceType || 'upload',
      input.taskId || null,
      input.workflowRunId || null,
      input.resultUrl || null,
      input.imageWidth || null,
      input.imageHeight || null,
    ]
  );

  const id = lastInsertRowid();
  return getMaterialById(id)!;
};

export const getMaterialById = (id: number): MaterialAsset | null => {
  const results = query(
    `
      SELECT m.*, u.email AS user_email, u.nickname AS user_nickname, t.name AS team_name
      FROM materials m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN teams t ON t.id = m.team_id
      WHERE m.id = ?
    `,
    [id]
  ) as MaterialAsset[];

  return results[0] || null;
};

export const listMaterials = (input: {
  userId: number;
  role: 'super_admin' | 'member';
  isTeamAdmin: boolean;
  teamId?: number;
  keyword?: string;
  limit?: number;
  sourceType?: 'upload' | 'generated';
  taskId?: number;
  workflowRunId?: number;
}) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const requestedTeamId = input.teamId;

  if (input.role === 'super_admin') {
    if (requestedTeamId !== undefined) {
      conditions.push('m.team_id = ?');
      params.push(requestedTeamId);
    }
  } else {
    const allowedTeamIds = getUserTeams(input.userId).map((team) => team.id);
    if (requestedTeamId !== undefined) {
      if (!allowedTeamIds.includes(requestedTeamId)) {
        return [];
      }
      conditions.push('m.team_id = ?');
      params.push(requestedTeamId);
    } else if (input.isTeamAdmin && allowedTeamIds.length > 0) {
      conditions.push(`m.team_id IN (${allowedTeamIds.map(() => '?').join(',')})`);
      params.push(...allowedTeamIds);
    } else {
      conditions.push('m.user_id = ?');
      params.push(input.userId);
    }
  }

  // 按来源类型筛选
  if (input.sourceType) {
    conditions.push('m.source_type = ?');
    params.push(input.sourceType);
  }

  // 按任务 ID 筛选
  if (input.taskId) {
    conditions.push('m.task_id = ?');
    params.push(input.taskId);
  }

  // 按工作流运行 ID 筛选
  if (input.workflowRunId) {
    conditions.push('m.workflow_run_id = ?');
    params.push(input.workflowRunId);
  }

  if (input.keyword?.trim()) {
    conditions.push('(m.original_name LIKE ? OR m.file_id LIKE ?)');
    params.push(`%${input.keyword.trim()}%`, `%${input.keyword.trim()}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = input.limit ?? 60;

  return query(
    `
      SELECT m.*, u.email AS user_email, u.nickname AS user_nickname, t.name AS team_name
      FROM materials m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN teams t ON t.id = m.team_id
      ${whereClause}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
    `,
    [...params, limit]
  ) as MaterialAsset[];
};

export const markMaterialUsed = (materialId: number) => {
  exec(
    `
      UPDATE materials
      SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [materialId]
  );
};

export const canAccessMaterial = (input: {
  material: MaterialAsset;
  userId: number;
  role: 'super_admin' | 'member';
  isTeamAdmin: boolean;
}) => {
  if (input.role === 'super_admin') return true;
  if (input.material.user_id === input.userId) return true;
  return isTeamMember(input.userId, input.material.team_id);
};
