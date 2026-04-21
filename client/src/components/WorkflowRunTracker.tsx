import { useEffect, useState } from 'react';
import { apiClient } from '@/api';
import type { WorkflowRunRecord } from '@/types';

interface WorkflowRunTrackerProps {
  runId: number;
  onComplete?: (run: WorkflowRunRecord) => void;
  onClose?: () => void;
}

interface TaskProgress {
  itemId: number;
  itemIndex: number;
  batchId: string;
  steps: Array<{
    stepKey: string;
    stepName: string;
    status: 'pending' | 'processing' | 'success' | 'failed';
    taskId: number;
    outputData?: Record<string, unknown>;
    resultUrl?: string;
    errorMessage?: string;
  }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: '等待中', color: 'bg-amber-100 text-amber-900', icon: '⏳' },
  processing: { label: '执行中', color: 'bg-sky-100 text-sky-900', icon: '⚙️' },
  success: { label: '成功', color: 'bg-emerald-100 text-emerald-900', icon: '✅' },
  failed: { label: '失败', color: 'bg-rose-100 text-rose-900', icon: '❌' },
};

export function WorkflowRunTracker({ runId, onComplete, onClose }: WorkflowRunTrackerProps) {
  const [run, setRun] = useState<WorkflowRunRecord | null>(null);
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRunStatus = async () => {
    try {
      const response = await apiClient.getWorkflowRun(runId);
      const runData = response.data.data as WorkflowRunRecord;
      setRun(runData);

      // 解析 results_json 获取每项的进度
      if (runData.results_json) {
        try {
          const results = JSON.parse(runData.results_json) as Array<{
            itemIndex: number;
            status: string;
            batchId: string;
            finalOutput?: Record<string, unknown>;
            errorMessage?: string;
          }>;

          // 获取该批次的任务详情
          const tasksResponse = await apiClient.getTasks({
            workflowRunId: String(runId),
            limit: '100',
          });
          const tasks = tasksResponse.data.data?.tasks || [];

          // 按 itemIndex 分组任务
          const itemMap = new Map<number, TaskProgress>();
          for (const result of results) {
            itemMap.set(result.itemIndex, {
              itemId: result.itemIndex,
              itemIndex: result.itemIndex,
              batchId: result.batchId,
              steps: [],
            });
          }

          // 填充任务详情
          for (const task of tasks) {
            const itemIndex = task.workflow_item_index as number;
            const item = itemMap.get(itemIndex);
            if (item) {
              const stepKey = (task.workflow_step_key as string) || 'unknown';
              const stepName = (task.workflow_step_name as string) || 'Unknown Step';
              const existingStep = item.steps.find((s) => s.stepKey === stepKey);

              if (!existingStep) {
                item.steps.push({
                  stepKey,
                  stepName,
                  status: task.status as TaskProgress['steps'][0]['status'],
                  taskId: task.id as number,
                  outputData: task.output_data ? JSON.parse(String(task.output_data)) : undefined,
                  resultUrl: task.result_url as string,
                  errorMessage: task.error_message as string,
                });
              } else {
                existingStep.status = task.status as TaskProgress['steps'][0]['status'];
                existingStep.outputData = task.output_data ? JSON.parse(String(task.output_data)) : undefined;
                existingStep.resultUrl = task.result_url as string;
                existingStep.errorMessage = task.error_message as string;
              }
            }
          }

          // 按 itemIndex 排序
          const sortedItems = Array.from(itemMap.values()).sort((a, b) => a.itemIndex - b.itemIndex);
          setTaskProgress(sortedItems);
        } catch (e) {
          console.error('Failed to parse results:', e);
        }
      }

      // 检查是否完成
      if (['success', 'partial_success', 'failed'].includes(runData.status)) {
        setAutoRefresh(false);
        onComplete?.(runData);
      }
    } catch (error) {
      console.error('Failed to fetch run status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRunStatus();
  }, [runId]);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      void fetchRunStatus();
    }, 2000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        加载执行进度...
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        未找到运行记录
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const totalSteps = taskProgress.length > 0 ? taskProgress[0].steps.length : 0;
  const totalStepExecutions = taskProgress.reduce((sum, item) => sum + item.steps.length, 0);
  const completedSteps = taskProgress.reduce(
    (sum, item) => sum + item.steps.filter((s) => s.status === 'success').length,
    0
  );
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / (taskProgress.length * totalSteps)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 总进度条 */}
      <div className="rounded-2xl border border-white/10 bg-[#111827] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusConfig.icon}</span>
            <div>
              <div className="font-medium text-white">
                {statusConfig.label} - {run.status}
              </div>
              <div className="text-xs text-slate-400">
                批次：{run.run_batch_id} | 完成：{run.completed_items}/{run.total_items} | 失败：{run.failed_items}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#e97b45]">{progressPercent}%</div>
            <div className="text-xs text-slate-400">
              {completedSteps}/{taskProgress.length * totalSteps} 步骤
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-gradient-to-r from-[#e97b45] to-[#f08f61] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 每项的详细进度 */}
      <div className="space-y-3">
        {taskProgress.map((item) => (
          <div key={item.itemIndex} className="overflow-hidden rounded-2xl border border-white/10 bg-[#151515]">
            <div className="border-b border-white/5 bg-[#1f1f1f] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">
                  图片 {item.itemIndex + 1}
                  <span className="ml-2 text-xs text-slate-400">批次：{item.batchId}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {item.steps.filter((s) => s.status === 'success').length}/{item.steps.length} 步骤完成
                </div>
              </div>
            </div>

            <div className="p-4">
              {/* 步骤流程展示 */}
              <div className="flex flex-wrap items-center gap-2">
                {item.steps.map((step, index) => (
                  <div key={step.stepKey} className="flex items-center">
                    {index > 0 && (
                      <div className="mx-2 h-px w-8 bg-slate-600" />
                    )}
                    <div
                      className={`flex flex-col items-center rounded-xl border px-3 py-2 ${
                        step.status === 'success'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : step.status === 'processing'
                          ? 'border-sky-500/30 bg-sky-500/10'
                          : step.status === 'failed'
                          ? 'border-rose-500/30 bg-rose-500/10'
                          : 'border-slate-600 bg-slate-700/50'
                      }`}
                    >
                      <div className="text-xs text-slate-400">{step.stepName}</div>
                      <div className="mt-1 text-sm">
                        {step.status === 'success' && '✅'}
                        {step.status === 'processing' && '⚙️'}
                        {step.status === 'failed' && '❌'}
                        {step.status === 'pending' && '⏳'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 结果预览 */}
              {item.steps.some((s) => s.resultUrl && s.status === 'success') && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {item.steps
                    .filter((s) => s.resultUrl && s.status === 'success')
                    .map((step) => {
                      const previewUrl = step.resultUrl?.startsWith('http')
                        ? step.resultUrl
                        : `${API_BASE}${step.resultUrl}`;
                      return (
                        <div key={step.stepKey} className="space-y-2">
                          <div className="text-xs text-slate-400">{step.stepName}</div>
                          <div className="aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#111]">
                            <img
                              src={previewUrl}
                              alt={step.stepName}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg bg-[#e97b45]/20 py-1.5 text-center text-xs text-[#e97b45] transition hover:bg-[#e97b45]/30"
                          >
                            查看大图
                          </a>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* 错误信息 */}
              {item.steps.some((s) => s.errorMessage) && (
                <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
                  {item.steps.find((s) => s.errorMessage)?.errorMessage}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {['success', 'partial_success', 'failed'].includes(run.status) && (
        <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm text-slate-300 transition hover:bg-white/5"
          >
            关闭
          </button>
          <a
            href={`/tasks?workflowRunId=${runId}`}
            className="rounded-xl bg-[#e97b45] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#f08f61]"
          >
            查看任务详情
          </a>
        </div>
      )}
    </div>
  );
}
