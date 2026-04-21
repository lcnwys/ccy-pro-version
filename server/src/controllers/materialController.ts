import { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.js';
import { canAccessMaterial, getMaterialById, listMaterials, markMaterialUsed } from '../services/materialService.js';
import { getBeijingTime } from '../utils/time.js';

const LOG_PREFIX = '[素材库]';

export const materialController = {
  list: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';
      const teamId = typeof req.query.teamId === 'string' && req.query.teamId ? Number(req.query.teamId) : undefined;
      const limit = typeof req.query.limit === 'string' && req.query.limit ? Number(req.query.limit) : 60;
      const sourceType = (typeof req.query.sourceType === 'string' && ['upload', 'generated'].includes(req.query.sourceType)) ? req.query.sourceType as 'upload' | 'generated' : undefined;
      const taskId = typeof req.query.taskId === 'string' && req.query.taskId ? Number(req.query.taskId) : undefined;
      const workflowRunId = typeof req.query.workflowRunId === 'string' && req.query.workflowRunId ? Number(req.query.workflowRunId) : undefined;

      console.log(`${LOG_PREFIX} [${timestamp}] 获取素材列表 user=${req.user!.id} teamId=${teamId ?? 'auto'} keyword=${keyword || '-'} sourceType=${sourceType || 'all'}`);

      const materials = listMaterials({
        userId: req.user!.id,
        role: req.user!.role,
        isTeamAdmin: Boolean(req.user!.is_team_admin),
        teamId,
        keyword,
        limit,
        sourceType,
        taskId,
        workflowRunId,
      });

      res.json({
        success: true,
        data: materials,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to list materials';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  markUsed: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const materialId = Number(req.params.id);
      const material = getMaterialById(materialId);

      if (!material) {
        return res.status(404).json({
          success: false,
          error: '素材不存在',
        });
      }

      if (!canAccessMaterial({
        material,
        userId: req.user!.id,
        role: req.user!.role,
        isTeamAdmin: Boolean(req.user!.is_team_admin),
      })) {
        return res.status(403).json({
          success: false,
          error: '无权访问该素材',
        });
      }

      markMaterialUsed(materialId);
      console.log(`${LOG_PREFIX} [${timestamp}] 标记素材已使用 materialId=${materialId}`);

      res.json({
        success: true,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update material usage';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },
};
