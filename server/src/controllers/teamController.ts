import { Response } from 'express';
import {
  getAllTeams,
  getTeamById,
  getUserTeams,
  getTeamMembers,
  removeTeamMember,
  setTeamApiKey,
  getTeamApiKey,
  getTeamApiKeyFull,
  isTeamAdmin,
  getTeamOwner,
} from '../services/teamService.js';
import type { AuthRequest } from '../middlewares/auth.js';

export const teamController = {
  /**
   * 获取我的团队列表
   */
  getMyTeams: async (req: AuthRequest, res: Response) => {
    try {
      const teams = req.user!.role === 'super_admin'
        ? getAllTeams()
        : getUserTeams(req.user!.id);

      res.json({
        success: true,
        data: teams,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取团队列表失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取团队详情
   */
  getTeam: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = getTeamById(teamId);

      if (!team) {
        return res.status(404).json({
          success: false,
          error: '团队不存在',
        });
      }

      // 检查权限：只有团队成员可以查看
      if (!isTeamAdmin(req.user!.id, teamId) && req.user!.role !== 'super_admin') {
        const isMember = getUserTeams(req.user!.id).some(t => t.id === teamId);
        if (!isMember) {
          return res.status(403).json({
            success: false,
            error: '无权限访问该团队',
          });
        }
      }

      res.json({
        success: true,
        data: team,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取团队详情失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取团队成员列表
   */
  getTeamMembers: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);

      // 检查权限
      if (!isTeamAdmin(req.user!.id, teamId) && req.user!.role !== 'super_admin') {
        const isMember = getUserTeams(req.user!.id).some(t => t.id === teamId);
        if (!isMember) {
          return res.status(403).json({
            success: false,
            error: '无权限访问该团队',
          });
        }
      }

      const members = getTeamMembers(teamId);

      res.json({
        success: true,
        data: members,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取成员列表失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 移除团队成员
   */
  removeMember: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // 检查权限：只有团队管理员可以移除成员
      if (!isTeamAdmin(req.user!.id, teamId)) {
        return res.status(403).json({
          success: false,
          error: '需要团队管理员权限',
        });
      }

      removeTeamMember(teamId, userId);

      res.json({
        success: true,
        message: '移除成功',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '移除成员失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 设置团队 API Key
   */
  setApiKey: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API Key 必填',
        });
      }

      // 验证团队 owner
      const ownerId = getTeamOwner(teamId);
      if (ownerId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: '只有团队创建者可以设置 API Key',
        });
      }

      setTeamApiKey(teamId, apiKey, req.user!.id);

      res.json({
        success: true,
        message: 'API Key 设置成功',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '设置 API Key 失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取团队 API Key（脱敏）
   */
  getApiKey: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);

      const maskedKey = getTeamApiKey(teamId, req.user!.id);

      res.json({
        success: true,
        data: {
          masked_key: maskedKey,
          configured: maskedKey !== null,
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

  /**
   * 获取完整 API Key（仅管理员）
   */
  getApiKeyFull: async (req: AuthRequest, res: Response) => {
    try {
      const teamId = parseInt(req.params.id);

      const apiKey = getTeamApiKeyFull(teamId, req.user!.id);

      res.json({
        success: true,
        data: {
          apiKey: apiKey,
          configured: apiKey !== null,
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
