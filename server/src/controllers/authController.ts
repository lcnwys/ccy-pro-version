import { Response } from 'express';
import { register, login, getUserById, createMemberByAdmin, getUserTeams, getUserBalance } from '../services/authService.js';
import { isTeamAdmin } from '../services/authService.js';
import type { AuthRequest } from '../middlewares/auth.js';

const LOG_PREFIX = '[认证服务]';

export const authController = {
  /**
   * 团队管理员注册 - 自动创建团队
   */
  register: async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, teamName, nickname } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '邮箱和密码必填',
        });
      }

      if (!teamName) {
        return res.status(400).json({
          success: false,
          error: '团队名称必填',
        });
      }

      console.log(`${LOG_PREFIX} 注册新用户 email=${email} teamName=${teamName}`);
      const result = await register(email, password, teamName, nickname);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '注册失败';
      res.status(400).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 用户登录
   */
  login: async (req: AuthRequest, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '邮箱和密码必填',
        });
      }

      console.log(`${LOG_PREFIX} 用户登录 email=${email}`);
      const result = await login(email, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '登录失败';
      res.status(401).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取当前用户信息
   */
  me: async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          error: '未登录',
        });
      }

      console.log(`${LOG_PREFIX} 获取用户信息 id=${user.id}`);

      // 获取用户团队（通过 team_members 表）
      const teams = getUserTeams(user.id);

      // 获取用户总额度
      const balance = getUserBalance(user.id, user.teamId || undefined);

      res.json({
        success: true,
        data: {
          ...user,
          teams,
          balance,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '获取用户信息失败';
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 团队管理员创建成员账号
   */
  createMember: async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, nickname } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: '邮箱和密码必填',
        });
      }

      // 验证当前用户是否是团队管理员
      if (!isTeamAdmin(req.user!.id)) {
        return res.status(403).json({
          success: false,
          error: '需要团队管理员权限',
        });
      }

      console.log(`${LOG_PREFIX} 创建成员账号 email=${email} by=${req.user!.id}`);
      const member = await createMemberByAdmin(req.user!.id, email, password, nickname);

      res.json({
        success: true,
        data: member,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '创建成员失败';
      res.status(400).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 修改密码
   */
  changePassword: async (req: AuthRequest, res: Response) => {
    res.json({
      success: true,
      message: '修改密码功能开发中',
    });
  },
};
