import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { workflowService, type WorkflowStep } from '../services/workflowService.js';
import { isTeamAdmin } from '../services/teamService.js';
import { getBeijingTime } from '../utils/time.js';
import { query, exec, lastInsertRowid } from '../database/index.js';
import { getTaskCost } from '../services/pricing.js';
import { queue } from '../queue/index.js';
import type { AuthRequest } from '../middlewares/auth.js';
import type { FunctionType } from '../services/types.js';

const LOG_PREFIX = '[工作流接口]';

export const workflowController = {
  list: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

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
    const timestamp = getBeijingTime();

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

  update: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const workflowId = parseInt(req.params.id, 10);
      const workflow = workflowService.getWorkflowById(workflowId);

      if (!workflow) {
        return res.status(404).json({ success: false, error: '工作流不存在' });
      }

      if (!workflowService.canManageWorkflow({
        id: req.user!.id,
        role: req.user!.role,
        is_team_admin: req.user!.is_team_admin,
      }, workflow.team_id)) {
        return res.status(403).json({ success: false, error: '无权修改该工作流' });
      }

      const { name, description, steps } = req.body as {
        name: string;
        description?: string;
        steps: WorkflowStep[];
      };

      if (!name?.trim()) {
        return res.status(400).json({ success: false, error: '工作流名称不能为空' });
      }

      const updated = workflowService.updateWorkflow({
        workflowId,
        name: name.trim(),
        description: description?.trim(),
        steps,
      });

      console.log(`${LOG_PREFIX} [${timestamp}] 工作流更新成功 workflowId=${workflowId}`);
      res.json({ success: true, data: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update workflow';
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
    const timestamp = getBeijingTime();

    try {
      const workflowId = parseInt(req.params.id, 10);
      const workflow = workflowService.getWorkflowById(workflowId);

      if (!workflow) {
        return res.status(404).json({ success: false, error: '工作流不存在' });
      }

      if (!workflowService.canAccessWorkflow({ id: req.user!.id, role: req.user!.role }, workflow.team_id)) {
        return res.status(403).json({ success: false, error: '无权执行该工作流' });
      }

      const { items, concurrency, teamId, dryRun } = req.body as {
        items: Array<Record<string, unknown>>;
        concurrency?: number;
        teamId?: number;
        dryRun?: boolean; // 调试模式：不实际调用 API，不扣费
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
        dryRun: dryRun || false,
        isSuperAdmin: req.user!.role === 'super_admin',
      });

      console.log(`${LOG_PREFIX} [${timestamp}] 工作流执行已启动 workflowId=${workflowId} runId=${run?.id} dryRun=${dryRun || false}`);
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

  listRunsAggregated: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();
    try {
      const workflowId = typeof req.query.workflowId === 'string' ? parseInt(req.query.workflowId, 10) : undefined;

      // 获取工作流运行列表
      const runs = workflowService.listRuns({
        id: req.user!.id,
        role: req.user!.role,
        teamId: req.user!.teamId,
        is_team_admin: req.user!.is_team_admin,
      }, workflowId);

      // 获取所有 run IDs
      const runIds = runs.map((r) => r.id as number);

      // 获取这些运行关联的所有任务
      let tasks: Array<Record<string, unknown>> = [];
      if (runIds.length > 0) {
        const placeholders = runIds.map(() => '?').join(',');
        tasks = query(`
          SELECT
            id,
            workflow_step_key,
            workflow_step_name,
            status,
            input_data,
            output_data,
            result_url,
            error_message,
            created_at,
            completed_at,
            workflow_run_id
          FROM tasks
          WHERE workflow_run_id IN (${placeholders})
          ORDER BY workflow_run_id, created_at ASC
        `, runIds) as Array<Record<string, unknown>>;
      }

      // 按 workflow_run_id 分组任务
      const tasksByRunId = new Map<number, Array<Record<string, unknown>>>();
      for (const task of tasks) {
        const runId = task.workflow_run_id as number;
        if (!tasksByRunId.has(runId)) {
          tasksByRunId.set(runId, []);
        }
        tasksByRunId.get(runId)!.push(task);
      }

      // 将任务附加到运行记录上
      const runsWithTasks = runs.map((run) => ({
        ...run,
        tasks: tasksByRunId.get(run.id as number) || [],
      }));

      console.log(`${LOG_PREFIX} [${timestamp}] 聚合工作流运行列表获取成功 count=${runsWithTasks.length}`);
      res.json({ success: true, data: { runs: runsWithTasks } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list aggregated workflow runs';
      console.error(`${LOG_PREFIX} [${timestamp}] 聚合工作流运行列表获取失败 error=${message}`);
      res.status(500).json({ success: false, error: message });
    }
  },

  retryStep: async (req: AuthRequest, res: Response) => {
    const timestamp = getBeijingTime();

    try {
      const runId = parseInt(req.params.id, 10);
      const { itemIndex, stepKey, inputData } = req.body as {
        itemIndex: number;
        stepKey: string;
        inputData?: Record<string, unknown>;
      };

      console.log(`${LOG_PREFIX} [${timestamp}] 重试工作流步骤 runId=${runId} itemIndex=${itemIndex} stepKey=${stepKey}`);

      const run = workflowService.getRunById(runId);
      if (!run) {
        return res.status(404).json({ success: false, error: '工作流运行不存在' });
      }

      if (req.user!.role !== 'super_admin') {
        const canAccess = run.created_by === req.user!.id || isTeamAdmin(req.user!.id, run.team_id);
        if (!canAccess) {
          return res.status(403).json({ success: false, error: '无权操作该工作流运行' });
        }
      }

      const workflow = workflowService.getWorkflowById(run.workflow_id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: '工作流不存在' });
      }

      const steps = workflow.steps;
      const stepIndex = steps.findIndex((s) => s.key === stepKey);
      if (stepIndex === -1) {
        return res.status(400).json({ success: false, error: `步骤 ${stepKey} 不存在` });
      }

      // 获取该 itemIndex 下所有已有任务
      const existingTasks = query(
        'SELECT * FROM tasks WHERE workflow_run_id = ? AND workflow_item_index = ? ORDER BY created_at ASC',
        [runId, itemIndex]
      ) as Array<Record<string, unknown>>;

      // 构建 context：收集之前成功步骤的输出
      const context: Record<string, Record<string, unknown>> = {};
      for (const task of existingTasks) {
        const taskStepKey = task.workflow_step_key as string;
        if (task.status === 'success' && task.output_data) {
          context[taskStepKey] = JSON.parse(String(task.output_data));
        }
      }

      // 将失败/后续步骤标记为 cancelled
      exec(`
        UPDATE tasks
        SET status = 'failed', error_message = '被步骤重试取消'
        WHERE workflow_run_id = ? AND workflow_item_index = ?
          AND workflow_step_key IN (${steps.slice(stepIndex).map(() => '?').join(',')})
          AND status IN ('pending', 'processing', 'failed')
      `, [runId, itemIndex, ...steps.slice(stepIndex).map((s) => s.key)]);

      // 从指定步骤开始重新创建任务
      const step = steps[stepIndex];
      const prevOutput = stepIndex > 0 ? context[steps[stepIndex - 1].key] || {} : {};

      // 解析 inputTemplate
      const inputItems = JSON.parse(run.input_items_json || '[]') as Array<Record<string, unknown>>;
      const item = inputItems[itemIndex] || {};

      // 简单模板解析：用 prevOutput 和 item 数据
      let resolvedInput: Record<string, unknown>;
      if (inputData) {
        resolvedInput = inputData;
      } else {
        resolvedInput = { ...step.inputTemplate };
        for (const [key, value] of Object.entries(resolvedInput)) {
          if (typeof value === 'string') {
            const match = value.match(/^\{\{\s*(\w+)\.(\w+)\s*\}\}$/);
            if (match) {
              const [, root, path] = match;
              if (root === 'prev' && prevOutput[path] !== undefined) {
                resolvedInput[key] = prevOutput[path];
              } else if (root === 'item' && item[path] !== undefined) {
                resolvedInput[key] = item[path];
              }
            }
          }
        }
      }

      const taskCost = getTaskCost(step.functionType, resolvedInput);

      exec(`
        INSERT INTO tasks (
          user_id, team_id, batch_id, function_type, status, input_data, cost,
          workflow_id, workflow_run_id, workflow_step_key, workflow_step_name, workflow_item_index
        )
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
      `, [
        run.created_by,
        run.team_id,
        `retry-${uuidv4().slice(0, 8)}`,
        step.functionType,
        JSON.stringify(resolvedInput),
        run.team_id ? taskCost : 0,
        run.workflow_id,
        runId,
        step.key,
        step.name,
        itemIndex,
      ]);

      const newTaskId = lastInsertRowid();
      queue.add({
        taskId: newTaskId,
        functionType: step.functionType,
        inputData: {
          ...resolvedInput,
          workflowMeta: {
            workflowId: run.workflow_id,
            workflowRunId: runId,
            workflowStepKey: step.key,
            workflowStepName: step.name,
            workflowItemIndex: itemIndex,
          },
        },
      });

      console.log(`${LOG_PREFIX} [${timestamp}] 工作流步骤重试成功 newTaskId=${newTaskId} step=${step.key}`);
      res.json({ success: true, data: { taskId: newTaskId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry workflow step';
      console.error(`${LOG_PREFIX} [${timestamp}] 工作流步骤重试失败 error=${message}`);
      res.status(500).json({ success: false, error: message });
    }
  },
};
