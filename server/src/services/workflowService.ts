import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { exec, lastInsertRowid, query } from '../database/index.js';
import { getUserBudget, consumeBudget } from './budgetService.js';
import { getTaskCost } from './pricing.js';
import { isTeamAdmin, isTeamMember } from './teamService.js';
import { chcyaiService } from './chcyaiService.js';
import type { FunctionType } from './types.js';

export interface WorkflowStep {
  key: string;
  name: string;
  functionType: FunctionType;
  inputTemplate: Record<string, unknown>;
}

export interface WorkflowRecord {
  id: number;
  name: string;
  description?: string | null;
  team_id: number;
  created_by: number;
  is_active: number;
  steps_json: string;
  created_at: string;
  updated_at: string;
  creator_email?: string;
  creator_nickname?: string | null;
  team_name?: string | null;
}

export interface WorkflowRunRecord {
  id: number;
  workflow_id: number;
  team_id: number;
  created_by: number;
  status: 'pending' | 'running' | 'partial_success' | 'success' | 'failed';
  concurrency: number;
  total_items: number;
  completed_items: number;
  failed_items: number;
  total_steps: number;
  run_batch_id: string;
  input_items_json: string;
  results_json?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  workflow_name?: string;
  workflow_description?: string | null;
  creator_email?: string;
  creator_nickname?: string | null;
  team_name?: string | null;
}

type WorkflowContext = {
  item: Record<string, unknown>;
  prev: Record<string, unknown>;
  steps: Record<string, Record<string, unknown>>;
  run: {
    id: number;
    itemIndex: number;
    workflowId: number;
    batchId: string;
  };
};

const LOG_PREFIX = '[工作流服务]';

const parseWorkflow = (record: WorkflowRecord) => {
  return {
    ...record,
    steps: JSON.parse(record.steps_json) as WorkflowStep[],
  };
};

const getByPath = (source: unknown, path: string) => {
  if (!path) return source;
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, source);
};

const resolveTemplateValue = (value: unknown, context: WorkflowContext): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, context));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, resolveTemplateValue(nestedValue, context)])
    );
  }

  if (typeof value !== 'string') {
    return value;
  }

  const exactMatch = value.match(/^\{\{\s*([^}]+)\s*\}\}$/);
  if (exactMatch) {
    const expression = exactMatch[1].trim();
    const [root, ...rest] = expression.split('.');
    const path = rest.join('.');
    if (root === 'item') return getByPath(context.item, path);
    if (root === 'prev') return getByPath(context.prev, path);
    if (root === 'run') return getByPath(context.run, path);
    if (root === 'steps') {
      const stepKey = rest.shift();
      const stepPath = rest.join('.');
      return stepKey ? getByPath(context.steps[stepKey], stepPath) : undefined;
    }
  }

  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const [root, ...rest] = expression.trim().split('.');
    const path = rest.join('.');
    let resolved: unknown;
    if (root === 'item') resolved = getByPath(context.item, path);
    if (root === 'prev') resolved = getByPath(context.prev, path);
    if (root === 'run') resolved = getByPath(context.run, path);
    if (root === 'steps') {
      const stepKey = rest.shift();
      const stepPath = rest.join('.');
      resolved = stepKey ? getByPath(context.steps[stepKey], stepPath) : undefined;
    }
    return resolved === undefined || resolved === null ? '' : String(resolved);
  });
};

const sanitizeResolvedInput = (value: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
  );
};

const insertWorkflowTask = (input: {
  userId: number;
  teamId: number;
  batchId: string;
  functionType: FunctionType;
  inputData: Record<string, unknown>;
  cost: number;
  workflowId: number;
  workflowRunId: number;
  workflowStepKey: string;
  workflowStepName: string;
  workflowItemIndex: number;
}) => {
  exec(`
    INSERT INTO tasks (
      user_id, team_id, batch_id, function_type, status, input_data, cost,
      workflow_id, workflow_run_id, workflow_step_key, workflow_step_name, workflow_item_index
    )
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.userId,
    input.teamId,
    input.batchId,
    input.functionType,
    JSON.stringify(input.inputData),
    input.cost,
    input.workflowId,
    input.workflowRunId,
    input.workflowStepKey,
    input.workflowStepName,
    input.workflowItemIndex,
  ]);

  return lastInsertRowid();
};

const updateWorkflowRun = (runId: number, updates: Record<string, unknown>) => {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  const sets = entries.map(([key]) => `${key} = ?`);
  const values = entries.map(([, value]) => value);
  exec(`
    UPDATE workflow_runs
    SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...values, runId]);
};

const runWithConcurrency = async <T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) => {
  const limit = Math.max(1, concurrency);
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
};

export const workflowService = {
  canAccessWorkflow: (user: { id: number; role: string }, workflowTeamId: number) => {
    if (user.role === 'super_admin') return true;
    if (workflowTeamId === 0) return false;
    return isTeamMember(user.id, workflowTeamId);
  },

  canManageWorkflow: (user: { id: number; role: string; is_team_admin?: boolean }, workflowTeamId: number) => {
    if (user.role === 'super_admin') return true;
    if (workflowTeamId === 0) return false;
    return Boolean(user.is_team_admin && isTeamAdmin(user.id, workflowTeamId));
  },

  validateSteps: (steps: WorkflowStep[]) => {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('至少需要一个步骤');
    }

    if (steps.length > config.workflow.maxStepsPerWorkflow) {
      throw new Error(`单个工作流最多允许 ${config.workflow.maxStepsPerWorkflow} 个步骤`);
    }

    const seenKeys = new Set<string>();
    steps.forEach((step, index) => {
      if (!step.key || !step.name || !step.functionType || !step.inputTemplate || typeof step.inputTemplate !== 'object') {
        throw new Error(`第 ${index + 1} 个步骤定义不完整`);
      }
      if (seenKeys.has(step.key)) {
        throw new Error(`步骤 key 重复: ${step.key}`);
      }
      seenKeys.add(step.key);
    });
  },

  createWorkflow: (input: {
    name: string;
    description?: string;
    teamId: number;
    createdBy: number;
    steps: WorkflowStep[];
  }) => {
    workflowService.validateSteps(input.steps);

    exec(`
      INSERT INTO workflows (name, description, team_id, created_by, steps_json)
      VALUES (?, ?, ?, ?, ?)
    `, [input.name, input.description || null, input.teamId, input.createdBy, JSON.stringify(input.steps)]);

    const id = lastInsertRowid();
    return workflowService.getWorkflowById(id);
  },

  getWorkflowById: (id: number) => {
    const rows = query(`
      SELECT
        w.*,
        u.email AS creator_email,
        u.nickname AS creator_nickname,
        t.name AS team_name
      FROM workflows w
      LEFT JOIN users u ON u.id = w.created_by
      LEFT JOIN teams t ON t.id = w.team_id
      WHERE w.id = ?
    `, [id]) as WorkflowRecord[];

    if (rows.length === 0) return null;
    return parseWorkflow(rows[0]);
  },

  listWorkflows: (user: { id: number; role: string; teamId?: number | null; is_team_admin?: boolean }) => {
    const params: unknown[] = [];
    let whereClause = 'WHERE w.is_active = 1';

    if (user.role !== 'super_admin') {
      whereClause += ' AND (w.team_id = ? OR w.created_by = ?)';
      params.push(user.teamId || 0, user.id);
    }

    const rows = query(`
      SELECT
        w.*,
        u.email AS creator_email,
        u.nickname AS creator_nickname,
        t.name AS team_name,
        (
          SELECT COUNT(*)
          FROM workflow_runs r
          WHERE r.workflow_id = w.id
        ) AS run_count
      FROM workflows w
      LEFT JOIN users u ON u.id = w.created_by
      LEFT JOIN teams t ON t.id = w.team_id
      ${whereClause}
      ORDER BY w.updated_at DESC, w.id DESC
    `, params) as Array<WorkflowRecord & { run_count: number }>;

    return rows.map((row) => ({
      ...parseWorkflow(row),
      run_count: row.run_count,
    }));
  },

  listRuns: (user: { id: number; role: string; teamId?: number | null; is_team_admin?: boolean }, workflowId?: number) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (workflowId) {
      conditions.push('r.workflow_id = ?');
      params.push(workflowId);
    }

    if (user.role === 'super_admin') {
      // 平台管理员查看全部
    } else if (user.is_team_admin && user.teamId) {
      conditions.push('(r.team_id = ? OR r.created_by = ?)');
      params.push(user.teamId, user.id);
    } else {
      conditions.push('r.created_by = ?');
      params.push(user.id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return query(`
      SELECT
        r.*,
        w.name AS workflow_name,
        w.description AS workflow_description,
        u.email AS creator_email,
        u.nickname AS creator_nickname,
        t.name AS team_name
      FROM workflow_runs r
      LEFT JOIN workflows w ON w.id = r.workflow_id
      LEFT JOIN users u ON u.id = r.created_by
      LEFT JOIN teams t ON t.id = r.team_id
      ${whereClause}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 50
    `, params) as WorkflowRunRecord[];
  },

  getRunById: (runId: number) => {
    const rows = query(`
      SELECT
        r.*,
        w.name AS workflow_name,
        w.description AS workflow_description,
        u.email AS creator_email,
        u.nickname AS creator_nickname,
        t.name AS team_name
      FROM workflow_runs r
      LEFT JOIN workflows w ON w.id = r.workflow_id
      LEFT JOIN users u ON u.id = r.created_by
      LEFT JOIN teams t ON t.id = r.team_id
      WHERE r.id = ?
    `, [runId]) as WorkflowRunRecord[];

    if (rows.length === 0) return null;
    return rows[0];
  },

  startRun: async (input: {
    workflowId: number;
    teamId: number;
    createdBy: number;
    items: Array<Record<string, unknown>>;
    requestedConcurrency?: number;
  }) => {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('至少需要一条批量输入');
    }

    if (input.items.length > config.workflow.maxItemsPerRun) {
      throw new Error(`单次执行最多允许 ${config.workflow.maxItemsPerRun} 条输入`);
    }

    const workflow = workflowService.getWorkflowById(input.workflowId);
    if (!workflow) {
      throw new Error('工作流不存在');
    }

    const steps = workflow.steps as WorkflowStep[];
    workflowService.validateSteps(steps);

    const runBatchId = uuidv4();
    const concurrency = Math.min(
      Math.max(1, input.requestedConcurrency || 1),
      config.workflow.maxParallelItems
    );

    exec(`
      INSERT INTO workflow_runs (
        workflow_id, team_id, created_by, status, concurrency, total_items, total_steps, run_batch_id, input_items_json
      )
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `, [
      input.workflowId,
      input.teamId,
      input.createdBy,
      concurrency,
      input.items.length,
      steps.length,
      runBatchId,
      JSON.stringify(input.items),
    ]);

    const runId = lastInsertRowid();

    void workflowService.processRun({
      runId,
      workflowId: input.workflowId,
      workflowName: workflow.name,
      teamId: input.teamId,
      createdBy: input.createdBy,
      steps,
      items: input.items,
      concurrency,
      runBatchId,
    });

    return workflowService.getRunById(runId);
  },

  processRun: async (input: {
    runId: number;
    workflowId: number;
    workflowName: string;
    teamId: number;
    createdBy: number;
    steps: WorkflowStep[];
    items: Array<Record<string, unknown>>;
    concurrency: number;
    runBatchId: string;
  }) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    console.log(`${LOG_PREFIX} [${timestamp}] 启动工作流运行 runId=${input.runId} workflowId=${input.workflowId} items=${input.items.length}`);

    updateWorkflowRun(input.runId, { status: 'running' });

    const results: Array<Record<string, unknown>> = [];
    let completedItems = 0;
    let failedItems = 0;

    await runWithConcurrency(input.items, input.concurrency, async (item, itemIndex) => {
      const itemBatchId = `${input.runBatchId}-${itemIndex + 1}`;
      const context: WorkflowContext = {
        item,
        prev: {},
        steps: {},
        run: {
          id: input.runId,
          itemIndex,
          workflowId: input.workflowId,
          batchId: itemBatchId,
        },
      };

      try {
        for (const step of input.steps) {
          const resolvedInput = sanitizeResolvedInput(
            resolveTemplateValue(step.inputTemplate, context) as Record<string, unknown>
          );
          const taskCost = getTaskCost(step.functionType, resolvedInput);

          if (input.teamId > 0) {
            const budget = getUserBudget(input.createdBy, input.teamId);
            if (!budget || budget.available < taskCost) {
              throw new Error(`额度不足，无法执行步骤 ${step.name}`);
            }
          }

          const taskId = insertWorkflowTask({
            userId: input.createdBy,
            teamId: input.teamId,
            batchId: itemBatchId,
            functionType: step.functionType,
            inputData: {
              ...resolvedInput,
              workflowMeta: {
                workflowId: input.workflowId,
                workflowRunId: input.runId,
                workflowName: input.workflowName,
                workflowStepKey: step.key,
                workflowStepName: step.name,
                workflowItemIndex: itemIndex,
              },
            },
            cost: input.teamId > 0 ? taskCost : 0,
            workflowId: input.workflowId,
            workflowRunId: input.runId,
            workflowStepKey: step.key,
            workflowStepName: step.name,
            workflowItemIndex: itemIndex,
          });

          if (input.teamId > 0) {
            consumeBudget(input.teamId, input.createdBy, taskCost, taskId);
          }

          exec(`
            UPDATE tasks
            SET status = 'processing'
            WHERE id = ?
          `, [taskId]);

          const output = await chcyaiService.execute(step.functionType, resolvedInput);

          exec(`
            UPDATE tasks
            SET status = 'success', output_data = ?, result_url = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            JSON.stringify(output),
            typeof output.tempUrl === 'string' ? output.tempUrl : null,
            taskId,
          ]);

          context.prev = output as Record<string, unknown>;
          context.steps[step.key] = output as Record<string, unknown>;
        }

        completedItems += 1;
        results.push({
          itemIndex,
          status: 'success',
          batchId: itemBatchId,
          finalOutput: context.prev,
        });
      } catch (error) {
        failedItems += 1;
        const errorMessage = error instanceof Error ? error.message : '工作流步骤执行失败';
        results.push({
          itemIndex,
          status: 'failed',
          batchId: itemBatchId,
          errorMessage,
        });

        exec(`
          UPDATE tasks
          SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
          WHERE workflow_run_id = ? AND workflow_item_index = ? AND status IN ('pending', 'processing')
        `, [errorMessage, input.runId, itemIndex]);
      } finally {
        updateWorkflowRun(input.runId, {
          completed_items: completedItems,
          failed_items: failedItems,
          results_json: JSON.stringify(results),
        });
      }
    });

    const finalStatus =
      failedItems === 0 ? 'success' :
        completedItems === 0 ? 'failed' :
          'partial_success';

    updateWorkflowRun(input.runId, {
      status: finalStatus,
      completed_items: completedItems,
      failed_items: failedItems,
      results_json: JSON.stringify(results),
      completed_at: new Date().toISOString(),
    });

    console.log(`${LOG_PREFIX} [${timestamp}] 工作流运行结束 runId=${input.runId} status=${finalStatus}`);
  },
};
