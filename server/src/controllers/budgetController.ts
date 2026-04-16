import { Response } from 'express';
import {
  rechargeBudget,
  allocateBudget,
  getTeamBudget,
  getUserBudget,
  getTransactions,
} from '../services/budgetService.js';
import { isTeamAdmin } from '../services/teamService.js';
import type { AuthRequest } from '../middlewares/auth.js';

export const budgetController = {
  /**
   * 平台管理员给团队充值预算
   */
  recharge: async (req: AuthRequest, res: Response) => {
    try {
      const { teamId, amount } = req.body;

      if (!teamId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '团队 ID 和充值金额必填',
        });
      }

      const budgetId = rechargeBudget(teamId, amount, req.user!.id);

      res.json({
        success: true,
        data: { budgetId },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '充值失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 团队管理员分配额度给成员
   */
  allocate: async (req: AuthRequest, res: Response) => {
    try {
      const { teamId, userId, amount } = req.body;

      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: '用户 ID 和分配金额必填',
        });
      }

      if (!teamId || Number.isNaN(Number(teamId))) {
        return res.status(400).json({
          success: false,
          error: '团队 ID 必填',
        });
      }

      if (req.user!.role !== 'super_admin' && !isTeamAdmin(req.user!.id, Number(teamId))) {
        return res.status(403).json({
          success: false,
          error: '需要团队管理员权限',
        });
      }

      allocateBudget(Number(teamId), Number(userId), Number(amount), req.user!.id);

      res.json({
        success: true,
        message: '分配成功',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '分配失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取团队预算
   */
  getTeamBudget: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const budget = getTeamBudget(teamId);

      if (!budget) {
        return res.status(404).json({
          success: false,
          error: '团队预算不存在',
        });
      }

      res.json({
        success: true,
        data: budget,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取预算失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取用户额度
   */
  getUserBudget: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.teamId);
      const budget = getUserBudget(req.user!.id, teamId);

      res.json({
        success: true,
        data: budget || { amount: 0, used_amount: 0, available: 0 },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取额度失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取交易流水
   */
  getTransactions: async (req: AuthRequest, res: Response) => {
    try {
      const { teamId, type } = req.query;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const transactions = getTransactions({
        teamId: teamId ? parseInt(teamId as string) : undefined,
        type: type as string,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取交易流水失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },
};
