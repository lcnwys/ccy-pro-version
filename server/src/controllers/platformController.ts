import { Response } from 'express';
import {
  createPlatformApiKey,
  getPlatformApiKeys,
  togglePlatformApiKey,
  deletePlatformApiKey,
  getActivePlatformApiKey,
} from '../services/platformService.js';
import { resetDatabase, getDatabase, saveDatabase } from '../database/index.js';
import type { AuthRequest } from '../middlewares/auth.js';

export const platformController = {
  /**
   * 创建平台 API Key
   */
  createApiKey: async (req: AuthRequest, res: Response) => {
    try {
      console.log('[Platform API] Creating API Key, body:', req.body);
      const { name, keyValue } = req.body;

      console.log('[Platform API] name:', name, 'keyValue:', keyValue);

      if (!name || !keyValue) {
        console.log('[Platform API] Validation failed: name or keyValue missing');
        return res.status(400).json({
          success: false,
          error: '名称和 Key 值必填',
        });
      }

      const id = createPlatformApiKey(name, keyValue);
      console.log('[Platform API] Created API Key with id:', id);

      res.json({
        success: true,
        data: { id },
      });
    } catch (error) {
      console.error('[Platform API] Error:', error);
      const errorMsg = error instanceof Error ? error.message : '创建 API Key 失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 重置数据库（开发环境专用）
   */
  resetDb: async (req: AuthRequest, res: Response) => {
    try {
      console.log('[Platform API] Resetting database...');
      await resetDatabase();
      await getDatabase();
      await saveDatabase();
      console.log('[Platform API] Database reset complete');

      res.json({
        success: true,
        message: '数据库已重置',
      });
    } catch (error) {
      console.error('[Platform API] Error resetting database:', error);
      const errorMsg = error instanceof Error ? error.message : '重置数据库失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取所有平台 API Key
   */
  getApiKeys: async (req: AuthRequest, res: Response) => {
    try {
      const keys = getPlatformApiKeys();

      res.json({
        success: true,
        data: keys,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取 API Key 列表失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 切换 API Key 状态
   */
  toggleApiKey: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const keyId = parseInt(id);

      if (Number.isNaN(keyId)) {
        return res.status(400).json({
          success: false,
          error: '无效的 API Key ID',
        });
      }

      const allKeys = getPlatformApiKeys();
      const existingKey = allKeys.find((key) => key.id === keyId);

      if (!existingKey) {
        return res.status(404).json({
          success: false,
          error: 'API Key 不存在',
        });
      }

      const nextState = !existingKey.is_active;

      if (!nextState) {
        const activeCount = allKeys.filter((key) => key.is_active).length;
        if (activeCount <= 1) {
          return res.status(400).json({
            success: false,
            error: '至少保留一个启用中的 API Key',
          });
        }
      } else {
        allKeys
          .filter((key) => key.id !== keyId && key.is_active)
          .forEach((key) => togglePlatformApiKey(key.id, false));
      }

      togglePlatformApiKey(keyId, nextState);

      res.json({
        success: true,
        data: {
          id: keyId,
          isActive: nextState,
        },
        message: `API Key 已${nextState ? '激活' : '停用'}`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '切换 API Key 状态失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 删除 API Key
   */
  deleteApiKey: async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      deletePlatformApiKey(parseInt(id));

      res.json({
        success: true,
        message: 'API Key 已删除',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '删除 API Key 失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取当前启用的 API Key（用于功能测试）
   */
  getActiveApiKey: async (req: AuthRequest, res: Response) => {
    try {
      const key = getActivePlatformApiKey();

      res.json({
        success: true,
        data: {
          apiKey: key,
          configured: key !== null,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取 API Key 失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },
};
