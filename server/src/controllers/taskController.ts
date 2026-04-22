import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, exec, lastInsertRowid } from '../database/index.js';
import { queue } from '../queue/index.js';
import { getUserBudget, consumeBudget } from '../services/budgetService.js';
import { getTaskCost } from '../services/pricing.js';
import { isTeamAdmin, isTeamMember } from '../services/teamService.js';
import { chcyaiService } from '../services/chcyaiService.js';
import { getBeijingTime } from '../utils/time.js';
import type { AuthRequest } from '../middlewares/auth.js';
import type { FunctionType } from '../services/types.js';

const LOG_PREFIX = '[任务服务]';

export const taskController = {
  /**
   * 创建单图任务
   */
  createSingle: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const { functionType, inputData, teamId } = req.body as {
        functionType: FunctionType;
        inputData: Record<string, unknown>;
        teamId?: number;
      };

      // 超级管理员可以使用平台模式（不传 teamId）
      const isSuperAdmin = req.user!.role === 'super_admin';
      const useTeamId = teamId || (isSuperAdmin ? 0 : null);

      if (!useTeamId && !isSuperAdmin) {
        return res.status(400).json({
          success: false,
          error: '必须选择团队',
        });
      }

      // 如果不是超级管理员，检查用户是否是该团队成员
      if (!isSuperAdmin && teamId && !isTeamMember(req.user!.id, teamId)) {
        return res.status(403).json({
          success: false,
          error: '无权在该团队创建任务',
        });
      }

      // 检查用户额度（超级管理员跳过检查）
      let userBudget = null;
      const taskCost = getTaskCost(functionType, inputData);
      if (!isSuperAdmin && teamId) {
        userBudget = getUserBudget(req.user!.id, teamId);

        if (!userBudget || userBudget.available < taskCost) {
          return res.status(402).json({
            success: false,
            error: '额度不足，请联系管理员充值',
            current: userBudget?.available || 0,
            required: taskCost,
          });
        }
      }

      const batchId = uuidv4();

      console.log(`${LOG_PREFIX} [${timestamp}] 创建单图任务 type=${functionType} batchId=${batchId}`);
      console.log(`${LOG_PREFIX}           inputData=${JSON.stringify(inputData).substring(0, 200)}`);

      // 任务表的 team_id 当前仍是非空字段，平台模式使用 0 作为系统占位值。
      exec(`
        INSERT INTO tasks (user_id, team_id, batch_id, function_type, status, input_data, cost)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `, [req.user!.id, useTeamId, batchId, functionType, JSON.stringify(inputData), isSuperAdmin ? 0 : taskCost]);

      const taskId = { id: lastInsertRowid() };

      console.log(`${LOG_PREFIX} [${timestamp}] 任务已创建 taskId=${taskId.id}`);

      // 预扣额度（超级管理员跳过）
      if (!isSuperAdmin && teamId) {
        consumeBudget(teamId, req.user!.id, taskCost, taskId.id);
      }

      // 加入队列
      queue.add({ taskId: taskId.id, functionType, inputData });
      console.log(`${LOG_PREFIX} [${timestamp}] 任务已加入队列 taskId=${taskId.id}`);

      res.json({
        success: true,
        data: { taskId: taskId.id, batchId, cost: isSuperAdmin ? 0 : taskCost },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create task';
      console.error(`${LOG_PREFIX} [${timestamp}] 创建任务失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 创建批量任务
   */
  createBatch: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const { functionType, items, teamId } = req.body as {
        functionType: FunctionType;
        items: Array<{ inputData: Record<string, unknown> }>;
        teamId?: number;
      };

      const isSuperAdmin = req.user!.role === 'super_admin';
      const useTeamId = teamId || (isSuperAdmin ? 0 : null);

      if (!teamId && !isSuperAdmin) {
        return res.status(400).json({
          success: false,
          error: '必须选择团队',
        });
      }

      // 如果不是超级管理员，检查用户是否是该团队成员
      if (!isSuperAdmin && teamId && !isTeamMember(req.user!.id, teamId)) {
        return res.status(403).json({
          success: false,
          error: '无权在该团队创建任务',
        });
      }

      const batchId = uuidv4();
      const taskIds: number[] = [];
      const perTaskCosts = items.map((item) => getTaskCost(functionType, item.inputData));
      const totalCost = perTaskCosts.reduce((sum, cost) => sum + cost, 0);

      // 检查用户额度是否充足（超级管理员跳过）
      if (!isSuperAdmin && teamId) {
        const userBudget = getUserBudget(req.user!.id, teamId);
        if (!userBudget || userBudget.available < totalCost) {
          return res.status(402).json({
            success: false,
            error: '额度不足，请联系管理员充值',
            current: userBudget?.available || 0,
            required: totalCost,
          });
        }
      }

      console.log(`${LOG_PREFIX} [${timestamp}] 创建批量任务 type=${functionType} count=${items.length} batchId=${batchId}`);

      // 创建所有子任务
      for (const [index, item] of items.entries()) {
        const taskCost = perTaskCosts[index];
        exec(`
          INSERT INTO tasks (user_id, team_id, batch_id, function_type, status, input_data, cost)
          VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `, [req.user!.id, useTeamId, batchId, functionType, JSON.stringify(item.inputData), isSuperAdmin ? 0 : taskCost]);

        const taskId = { id: lastInsertRowid() };
        taskIds.push(taskId.id);

        // 预扣额度（超级管理员跳过）
        if (!isSuperAdmin && teamId) {
          consumeBudget(teamId, req.user!.id, taskCost, taskId.id);
        }

        // 加入队列
        queue.add({ taskId: taskId.id, functionType, inputData: item.inputData });
      }

      console.log(`${LOG_PREFIX} [${timestamp}] 批量任务已创建 batchId=${batchId} taskIds=[${taskIds.join(', ')}]`);

      res.json({
        success: true,
        data: { batchId, taskIds, total: items.length, totalCost: isSuperAdmin ? 0 : totalCost },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create batch';
      console.error(`${LOG_PREFIX} [${timestamp}] 创建批量任务失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取任务详情
   */
  getById: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();
    const { id } = req.params;

    try {
      console.log(`${LOG_PREFIX} [${timestamp}] 获取任务详情 id=${id}`);

      const tasks = query('SELECT * FROM tasks WHERE id = ?', [parseInt(id)]) as Array<Record<string, unknown>>;

      if (tasks.length === 0) {
        console.log(`${LOG_PREFIX} [${timestamp}] 任务不存在 id=${id}`);
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      const task = tasks[0];

      // 检查权限：只有任务创建者或同团队成员可查看
      if (req.user!.role !== 'super_admin' && task.user_id !== req.user!.id) {
        if (!isTeamMember(req.user!.id, task.team_id as number)) {
          return res.status(403).json({
            success: false,
            error: '无权查看该任务',
          });
        }
      }

      console.log(`${LOG_PREFIX} [${timestamp}] 任务详情获取成功 status=${task.status}`);

      res.json({
        success: true,
        data: task,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get task';
      console.error(`${LOG_PREFIX} [${timestamp}] 获取任务失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  refreshResultUrl: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();
    const { id } = req.params;

    try {
      console.log(`${LOG_PREFIX} [${timestamp}] 刷新任务结果链接 id=${id}`);

      const tasks = query('SELECT * FROM tasks WHERE id = ?', [parseInt(id, 10)]) as Array<Record<string, unknown>>;
      if (tasks.length === 0) {
        return res.status(404).json({ success: false, error: 'Task not found' });
      }

      const task = tasks[0];

      if (req.user!.role !== 'super_admin' && task.user_id !== req.user!.id) {
        if (!isTeamMember(req.user!.id, task.team_id as number)) {
          return res.status(403).json({ success: false, error: '无权查看该任务' });
        }
      }

      if (task.status !== 'success') {
        return res.status(400).json({ success: false, error: '只有成功任务才可刷新结果链接' });
      }

      if (!task.task_id_origin || typeof task.task_id_origin !== 'string') {
        return res.status(400).json({ success: false, error: '该任务缺少上游 taskId，无法刷新结果链接' });
      }

      const tempUrl = await chcyaiService.getTempUrl(task.function_type as FunctionType, task.task_id_origin);
      const currentOutput = task.output_data ? JSON.parse(String(task.output_data)) as Record<string, unknown> : {};
      const nextOutput = { ...currentOutput, tempUrl };

      exec(`
        UPDATE tasks
        SET result_url = ?, output_data = ?
        WHERE id = ?
      `, [tempUrl, JSON.stringify(nextOutput), parseInt(id, 10)]);

      const refreshedTasks = query('SELECT * FROM tasks WHERE id = ?', [parseInt(id, 10)]) as Array<Record<string, unknown>>;
      res.json({
        success: true,
        data: refreshedTasks[0],
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to refresh result url';
      console.error(`${LOG_PREFIX} [${timestamp}] 刷新结果链接失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 批量刷新任务结果链接
   */
  batchRefreshResultUrls: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();
    const { taskIds } = req.body as { taskIds: number[] };

    try {
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ success: false, error: 'taskIds 不能为空' });
      }

      console.log(`${LOG_PREFIX} [${timestamp}] 批量刷新结果链接 count=${taskIds.length}`);

      const results: Array<Record<string, unknown>> = [];

      for (const taskId of taskIds) {
        try {
          const tasks = query('SELECT * FROM tasks WHERE id = ?', [taskId]) as Array<Record<string, unknown>>;
          if (tasks.length === 0) continue;

          const task = tasks[0];

          if (task.status !== 'success' || !task.task_id_origin) continue;

          const tempUrl = await chcyaiService.getTempUrl(task.function_type as FunctionType, task.task_id_origin as string);
          const currentOutput = task.output_data ? JSON.parse(String(task.output_data)) as Record<string, unknown> : {};
          const nextOutput = { ...currentOutput, tempUrl };

          exec(`
            UPDATE tasks SET result_url = ?, output_data = ? WHERE id = ?
          `, [tempUrl, JSON.stringify(nextOutput), taskId]);

          const refreshed = query('SELECT * FROM tasks WHERE id = ?', [taskId]) as Array<Record<string, unknown>>;
          results.push(refreshed[0]);
        } catch (error) {
          console.warn(`${LOG_PREFIX} [${timestamp}] 刷新单个任务失败 taskId=${taskId} error=${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      res.json({ success: true, data: results });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to batch refresh';
      res.status(500).json({ success: false, error: errorMsg });
    }
  },

  /**
   * 获取批量任务进度
   */
  getBatchProgress: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();
    const { batchId } = req.params;

    try {
      console.log(`${LOG_PREFIX} [${timestamp}] 获取批量进度 batchId=${batchId}`);

      const tasks = query('SELECT * FROM tasks WHERE batch_id = ? ORDER BY workflow_item_index ASC, created_at ASC', [batchId]) as Array<Record<string, unknown>>;

      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'success').length;
      const failed = tasks.filter(t => t.status === 'failed').length;
      const processing = tasks.filter(t => t.status === 'processing').length;
      const pending = tasks.filter(t => t.status === 'pending').length;

      // 确定整体状态：只要有失败的，整体就是 failed
      let overallStatus = 'processing';
      if (failed > 0) {
        overallStatus = 'failed';
      } else if (pending === 0 && processing === 0 && completed === total) {
        overallStatus = 'success';
      }

      console.log(`${LOG_PREFIX} [${timestamp}] 批量进度 batchId=${batchId} total=${total} completed=${completed}`);

      res.json({
        success: true,
        data: {
          batchId,
          total,
          completed,
          failed,
          processing,
          pending,
          progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          status: overallStatus,
          tasks,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get progress';
      console.error(`${LOG_PREFIX} [${timestamp}] 获取进度失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },

  /**
   * 获取任务列表（支持筛选）
   */
  getList: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      console.log(`${LOG_PREFIX} [${timestamp}] 获取任务列表`);

      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const functionType = typeof req.query.functionType === 'string' ? req.query.functionType : undefined;
      const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;
      const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
      const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined;
      const workflowId = typeof req.query.workflowId === 'string' ? req.query.workflowId : undefined;
      const workflowRunId = typeof req.query.workflowRunId === 'string' ? req.query.workflowRunId : undefined;
      const workflowStepKey = typeof req.query.workflowStepKey === 'string' ? req.query.workflowStepKey : undefined;
      const page = typeof req.query.page === 'string' ? req.query.page : '1';
      const limit = typeof req.query.limit === 'string' ? req.query.limit : '20';
      const resolvedTeamId = teamId ? parseInt(teamId, 10) : undefined;

      const conditions: string[] = [];
      const params: unknown[] = [];
      let resolvedScope: 'mine' | 'team' | 'platform' = 'mine';

      if (req.user!.role === 'super_admin') {
        if (resolvedTeamId && resolvedTeamId > 0) {
          conditions.push('t.team_id = ?');
          params.push(resolvedTeamId);
          resolvedScope = 'team';
        } else {
          resolvedScope = 'platform';
        }
      } else if (scope === 'team' || resolvedTeamId) {
        const targetTeamId = resolvedTeamId || req.user!.teamId;

        if (!targetTeamId) {
          return res.status(400).json({
            success: false,
            error: '团队管理员模式需要指定团队',
          });
        }

        if (!isTeamAdmin(req.user!.id, targetTeamId)) {
          return res.status(403).json({
            success: false,
            error: '只有团队管理员可以查看团队全部任务',
          });
        }

        conditions.push('t.team_id = ?');
        params.push(targetTeamId);
        resolvedScope = 'team';
      } else {
        conditions.push('t.user_id = ?');
        params.push(req.user!.id);
        resolvedScope = 'mine';
      }

      if (status) {
        conditions.push('t.status = ?');
        params.push(status);
      }
      if (functionType) {
        conditions.push('t.function_type = ?');
        params.push(functionType);
      }
      if (workflowId) {
        conditions.push('t.workflow_id = ?');
        params.push(parseInt(workflowId, 10));
      }
      if (workflowRunId) {
        conditions.push('t.workflow_run_id = ?');
        params.push(parseInt(workflowRunId, 10));
      }
      if (workflowStepKey) {
        conditions.push('t.workflow_step_key = ?');
        params.push(workflowStepKey);
      }
      if (keyword) {
        conditions.push(`(
          CAST(t.id AS TEXT) LIKE ?
          OR t.batch_id LIKE ?
          OR u.email LIKE ?
          OR COALESCE(u.nickname, '') LIKE ?
          OR COALESCE(t.workflow_step_name, '') LIKE ?
          OR COALESCE(t.workflow_step_key, '') LIKE ?
        )`);
        const likeKeyword = `%${keyword}%`;
        params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitNum = parseInt(limit);
      const offsetNum = (parseInt(page) - 1) * limitNum;

      const tasks = query(`
        SELECT
          t.*,
          u.email AS user_email,
          u.nickname AS user_nickname,
          team.name AS team_name,
          (
            SELECT COUNT(*)
            FROM tasks batch_tasks
            WHERE batch_tasks.batch_id = t.batch_id
          ) AS batch_total,
          (
            SELECT COUNT(*)
            FROM tasks batch_tasks
            WHERE batch_tasks.batch_id = t.batch_id AND batch_tasks.status = 'success'
          ) AS batch_success,
          (
            SELECT COUNT(*)
            FROM tasks batch_tasks
            WHERE batch_tasks.batch_id = t.batch_id AND batch_tasks.status = 'failed'
          ) AS batch_failed,
          (
            SELECT COUNT(*)
            FROM tasks batch_tasks
            WHERE batch_tasks.batch_id = t.batch_id AND batch_tasks.status = 'processing'
          ) AS batch_processing
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN teams team ON team.id = t.team_id
        ${whereClause}
        ORDER BY ${workflowRunId ? 't.workflow_item_index ASC, t.created_at ASC' : 't.created_at DESC'}
        LIMIT ? OFFSET ?
      `, [...params, limitNum, offsetNum]);

      const totalResult = query(`
        SELECT COUNT(*) as count
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ${whereClause}
      `, params);

      const summaryResult = query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN t.status = 'processing' THEN 1 ELSE 0 END) AS processing,
          SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) AS success,
          SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed,
          COUNT(DISTINCT t.batch_id) AS batches,
          COUNT(DISTINCT t.user_id) AS users,
          COUNT(DISTINCT CASE WHEN t.team_id > 0 THEN t.team_id END) AS teams,
          COALESCE(SUM(t.cost), 0) AS total_cost
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ${whereClause}
      `, params);

      const functionSummary = query(`
        SELECT
          t.function_type,
          COUNT(*) AS total,
          SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) AS success,
          SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) AS failed,
          COALESCE(SUM(t.cost), 0) AS total_cost
        FROM tasks t
        LEFT JOIN users u ON u.id = t.user_id
        ${whereClause}
        GROUP BY t.function_type
        ORDER BY total DESC
      `, params);

      console.log(`${LOG_PREFIX} [${timestamp}] 任务列表获取成功 count=${tasks.length}`);

      res.json({
        success: true,
        data: {
          scope: resolvedScope,
          summary: summaryResult[0] || {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            failed: 0,
            batches: 0,
            users: 0,
            teams: 0,
            total_cost: 0,
          },
          functionSummary,
          tasks,
          pagination: {
            page: parseInt(page),
            limit: limitNum,
            total: (totalResult[0] as { count: number }).count,
            totalPages: Math.ceil((totalResult[0] as { count: number }).count / limitNum),
          },
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to get tasks';
      console.error(`${LOG_PREFIX} [${timestamp}] 获取任务列表失败 error=${errorMsg}`);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  },
};
