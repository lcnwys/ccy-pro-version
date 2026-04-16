import { Request, Response, NextFunction } from 'express';
import { verifyToken, getUserById } from '../services/authService.js';
import { isTeamAdmin as checkTeamAdmin } from '../services/teamService.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: 'super_admin' | 'member';
    teamId?: number;
    is_team_admin?: boolean;
  };
}

/**
 * 验证用户是否登录
 */
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '请先登录',
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    const user = getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户不存在',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      teamId: user.team_id || undefined,
      is_team_admin: Boolean(user.is_team_admin),
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: '认证失败，请重新登录',
    });
  }
};

/**
 * 验证是否是超级管理员
 */
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: '需要管理员权限',
    });
  }
  next();
};

/**
 * 验证是否是团队管理员
 */
export const requireTeamAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  const teamId = req.params.teamId || req.body.teamId;
  if (!teamId) {
    return res.status(400).json({
      success: false,
      error: '缺少团队 ID',
    });
  }

  if (!checkTeamAdmin(req.user!.id, parseInt(teamId))) {
    return res.status(403).json({
      success: false,
      error: '需要团队管理员权限',
    });
  }

  next();
};

/**
 * 可选认证（不强制登录）
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      const user = getUserById(payload.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          teamId: user.team_id || undefined,
          is_team_admin: Boolean(user.is_team_admin),
        };
      }
    }
  } catch (e) {
    // Token 无效，继续作为未登录用户
  }
  next();
};
