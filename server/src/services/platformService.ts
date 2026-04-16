import { query, exec, lastInsertRowid } from '../database/index.js';

export interface PlatformApiKey {
  id: number;
  key_value: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

/**
 * 创建平台 API Key
 */
export const createPlatformApiKey = (name: string, keyValue: string): number => {
  console.log('[Platform Service] Creating API Key:', { name, keyValueLength: keyValue?.length });

  // 验证参数
  if (!name || !keyValue) {
    throw new Error('名称或 Key 值为空');
  }

  exec(`
    INSERT INTO api_keys (name, key_value, is_active)
    VALUES (?, ?, 1)
  `, [name, keyValue]);

  const id = lastInsertRowid();
  console.log('[Platform Service] Created API Key with id:', id);
  return id;
};

/**
 * 获取所有平台 API Key
 */
export const getPlatformApiKeys = (): PlatformApiKey[] => {
  return query(`
    SELECT * FROM api_keys ORDER BY created_at DESC
  `) as PlatformApiKey[];
};

/**
 * 激活/停用 API Key
 */
export const togglePlatformApiKey = (id: number, isActive: boolean): void => {
  exec(`
    UPDATE api_keys SET is_active = ?, last_used_at = NULL WHERE id = ?
  `, [isActive ? 1 : 0, id]);
};

/**
 * 删除 API Key
 */
export const deletePlatformApiKey = (id: number): void => {
  exec('DELETE FROM api_keys WHERE id = ?', [id]);
};

/**
 * 获取启用的 API Key（用于 API 调用）
 */
export const getActivePlatformApiKey = (): string | null => {
  const keys = query(`
    SELECT key_value FROM api_keys WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1
  `) as Array<{ key_value: string }>;

  return keys.length > 0 ? keys[0].key_value : null;
};

/**
 * 记录 API Key 使用
 */
export const recordApiKeyUsage = (id: number): void => {
  exec(`
    UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id]);
};
