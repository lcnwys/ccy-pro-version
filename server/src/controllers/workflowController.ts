import { Response } from 'express';
import { workflowService, type WorkflowStep } from '../services/workflowService.js';
import { isTeamAdmin } from '../services/teamService.js';
import type { AuthRequest } from '../middlewares/auth.js';

const LOG_PREFIX = '[工作流接口]';

export const workflowController = {
  list: async (req: AuthRequest, res: Response) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    try {
      console.log(`${LOG_PREFIX} [${timestamp}] 获取工作流列表 userId=${req.user!.id}`);
      const workflows = workflowService.listWorkflows({
        id: req.user!.id,
        role: req.user!.role,
        teamId: req.user!.teamId,
        is_team_admin: req.user!.is_team_admin,
      });

      res.json({
        success: true,
        data: workflows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list workflows';
      res.status(500).json({ success: false, error: message });
    }
  },

  create: async (req: AuthRequest, res: Response) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    try {
      const { name, description, teamId, steps } = req.body as {
        name: string;
        description?: string;
        teamId?: number;
        steps: WorkflowStep[];
      };

      const resolvedTeamId = teamId || (req.user!.role === 'super_admin' ? 0 : req.user!.teamId || 0);

      if (!name?.trim()) {
        return res.status(400).json({ success: false, error: '工作流名称不能为空' });
      }

      if (req.user!.role !== 'super_admin') {
        if (!resolvedTeamId || !req.user!.is_team_admin || !isTeamAdmin(req.user!.id, resolvedTeamId)) {
          return res.status(403).json({ success: false, error: '只有团队管理员可以创建工作流' });
        }
      }

      const workflow = workflowService.createWorkflow({
        name: name.trim(),
        description: description?.trim(),
        teamId: resolvedTeamId,
        createdBy: req.user!.id,
        steps,
      });

      console.log(`${LOG_PREFIX} [${timestamp}] 工作流创建成功 workflowId=${workflow?.id}`);
      res.json({ success: true, data: workflow });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create workflow';
      res.status(400).json({ success: false, error: message });
    }
  },

  getById: async (req: AuthRequest, res: Response) => {
    const workflow = workflowService.getWorkflowById(parseInt(req.params.id, 10));
    if (!workflow) {
      return res.status(404).json({ success: false, error: '工作流不存在' });
    }

    if (!workflowService.canAccessWorkflow({ id: req.user!.id, role: req.user!.role }, workflow.team_id)) {
      return res.status(403).json({ success: false, error: '无权查看该工作流' });
    }

    res.json({ success: true, data: workflow });
  },

  run: async (req: AuthRequest, res: Response) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');

    try {
      const workflowId = parseInt(req.params.id, 10);
      const workflow = workflowService.getWorkflowById(workflowId);

      if (!workflow) {
        return res.status(404).json({ success: false, error: '工作流不存在' });
      }

      if (!workflowService.canAccessWorkflow({ id: req.user!.id, role: req.user!.role }, workflow.team_id)) {
        return res.status(403).json({ success: false, error: '无权执行该工作流' });
      }

      const { items, concurrency, teamId } = req.body as {
        items: Array<Record<string, unknown>>;
        concurrency?: number;
        teamId?: number;
      };

      const resolvedTeamId = req.user!.role === 'super_admin'
        ? (typeof teamId === 'number' ? teamId : workflow.team_id)
        : (workflow.team_id || req.user!.teamId || 0);

      const run = await workflowService.startRun({
        workflowId,
        teamId: resolvedTeamId,
        createdBy: req.user!.id,
        items,
        requestedConcurrency: concurrency,
      });

      console.log(`${LOG_PREFIX} [${timestamp}] 工作流执行已启动 workflowId=${workflowId} runId=${run?.id}`);
      res.json({ success: true, data: run });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run workflow';
      res.status(400).json({ success: false, error: message });
    }
  },

  listRuns: async (req: AuthRequest, res: Response) => {
    try {
      const workflowId = typeof req.query.workflowId === 'string' ? parseInt(req.query.workflowId, 10) : undefined;
      const runs = workflowService.listRuns({
        id: req.user!.id,
        role: req.user!.role,
        teamId: req.user!.teamId,
        is_team_admin: req.user!.is_team_admin,
      }, workflowId);

      res.json({ success: true, data: runs });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list workflow runs';
      res.status(500).json({ success: false, error: message });
    }
  },

  getRunById: async (req: AuthRequest, res: Response) => {
    const run = workflowService.getRunById(parseInt(req.params.id, 10));
    if (!run) {
      return res.status(404).json({ success: false, error: '工作流运行不存在' });
    }

    if (req.user!.role !== 'super_admin') {
      const canAccess = run.created_by === req.user!.id || (run.team_id > 0 && isTeamAdmin(req.user!.id, run.team_id)) || run.team_id === req.user!.teamId;
      if (!canAccess) {
        return res.status(403).json({ success: false, error: '无权查看该工作流运行' });
      }
    }

    res.json({ success: true, data: run });
  },
};
