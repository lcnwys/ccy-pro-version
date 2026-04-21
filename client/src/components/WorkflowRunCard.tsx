import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { WorkflowRunRecord, WorkflowStep } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  running: 'bg-sky-100 text-sky-900 border-sky-200',
  partial_success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  failed: 'bg-rose-100 text-rose-900 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  running: '运行中',
  partial_success: '部分成功',
  success: '成功',
  failed: '失败',
};

interface WorkflowRunCardProps {
  run: WorkflowRunRecord;
  tasks?: Array<{
    id: number;
    workflow_step_key: string;
    workflow_step_name: string;
    status: string;
    input_data: string;
    output_data?: string | null;
    result_url?: string | null;
    error_message?: string | null;
    created_at: string;
    completed_at?: string | null;
  }>;
  workflowSteps?: WorkflowStep[];
  onExpand?: (runId: number) => void;
}

const FUNCTION_NAMES: Record<string, string> = {
  'image-generation': 'AI 生图',
  'print-generation': '打印图生成',
  'pattern-extraction': '印花提取',
  'fission': '印花裂变',
  'becomes-clear': 'AI 变清晰',
  'clothing-upper': '模特上装',
  'clothing-wrinkle-removal': '服装去皱',
  'cut-out-portrait': '抠头像',
  'clothing-diagram': '3D 服装',
  'garment-extractions': '服装提取',
  'intelligent-matting': '智能抠图',
};

const extractImageUrl = (dataString: string | null | undefined, priorityKeys: string[]) => {
  if (!dataString) return null;
  try {
    const data = JSON.parse(dataString) as Record<string, unknown>;
    for (const key of priorityKeys) {
      const value = data[key];
      if (typeof value === 'string' && value.startsWith('http')) {
        return value;
      }
    }
  } catch {
    return null;
  }
  return null;
};

export function WorkflowRunCard({ run, tasks = [], workflowSteps, onExpand }: WorkflowRunCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const progress = run.total_items > 0 ? Math.round((run.completed_items / run.total_items) * 100) : 0;
  const statusColor = STATUS_COLORS[run.status] || STATUS_COLORS.pending;

  // 将 tasks 按 workflow_step_key 分组
  const stepsWithTasks = workflowSteps?.map((step) => {
    const stepTasks = tasks.filter((t) => t.workflow_step_key === step.key);
    return {
      ...step,
      tasks: stepTasks,
    };
  });

  const handleToggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onExpand?.(run.id);
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 头部：工作流运行摘要 */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold border ${statusColor}`}>
              {STATUS_LABELS[run.status] || run.status}
            </span>
            <span className="font-semibold text-slate-900">
              #{run.id} · {run.workflow_name || `Workflow ${run.workflow_id}`}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>进度：{run.completed_items}/{run.total_items} ({progress}%)</span>
            <span>并发：{run.concurrency}</span>
            <span>{new Date(run.created_at).toLocaleString('zh-CN')}</span>
            <button
              onClick={handleToggleExpand}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {isExpanded ? '收起' : '展开详情'}
            </button>
            <Link
              to={`/batches/wr-${run.id}`}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              查看批次详情
            </Link>
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all ${run.status === 'failed' ? 'bg-rose-500' : 'bg-cyan-600'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 展开后显示详细的步骤流程 */}
      {isExpanded && stepsWithTasks && (
        <div className="px-4 py-4">
          <div className="space-y-4">
            {stepsWithTasks.map((step, index) => {
              const stepTasks = step.tasks || [];
              const successCount = stepTasks.filter((t) => t.status === 'success').length;
              const failedCount = stepTasks.filter((t) => t.status === 'failed').length;
              const stepStatus = failedCount > 0 ? 'failed' : successCount === stepTasks.length ? 'success' : 'processing';

              return (
                <div key={step.key} className="relative">
                  {/* 步骤连接线 */}
                  {index < stepsWithTasks.length - 1 && (
                    <div className="absolute left-6 top-12 h-8 w-0.5 bg-slate-200" />
                  )}
                  {/* 步骤卡片 */}
                  <div className={`rounded-xl border-2 p-4 ${
                    stepStatus === 'success' ? 'border-emerald-200 bg-emerald-50/50' :
                    stepStatus === 'failed' ? 'border-rose-200 bg-rose-50/50' :
                    'border-slate-200 bg-white'
                  }`}>
                    <div className="flex items-start gap-3">
                      {/* 步骤序号 */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${
                        stepStatus === 'success' ? 'bg-emerald-500 text-white' :
                        stepStatus === 'failed' ? 'bg-rose-500 text-white' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      {/* 步骤信息 */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{step.name}</div>
                            <div className="text-xs text-slate-500">
                              {FUNCTION_NAMES[step.functionType] || step.functionType} · {step.key}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-medium text-slate-700">
                              成功 {successCount} / 失败 {failedCount} / 共 {stepTasks.length}
                            </div>
                            {stepTasks.length > 0 && stepTasks[0].completed_at && (
                              <div className="text-slate-400">
                                完成：{new Date(stepTasks[0].completed_at).toLocaleString('zh-CN')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 任务列表：每个任务显示输入/输出对比 */}
                        {stepTasks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {stepTasks.slice(0, 10).map((task) => {
                              const inputImageUrl = extractImageUrl(task.input_data, ['referenceImageUrl', 'imageUrl', 'image', 'url']);
                              const outputImageUrl = task.result_url || extractImageUrl(task.output_data, ['tempUrl', 'imageUrl', 'url']);

                              return (
                                <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-slate-500">
                                      任务 #{task.id} · {task.status === 'success' ? '成功' : task.status === 'failed' ? '失败' : '处理中'}
                                    </div>
                                    {task.error_message && (
                                      <div className="text-xs text-rose-600">{task.error_message}</div>
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center gap-4">
                                    {/* 输入图 */}
                                    <div className="flex-1">
                                      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">输入</div>
                                      <div className="aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                        {inputImageUrl ? (
                                          <img src={inputImageUrl} alt="input" className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                                            无输入图
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {/* 箭头 */}
                                    <div className="flex items-center justify-center">
                                      <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                    {/* 输出图 */}
                                    <div className="flex-1">
                                      <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-slate-400">输出</div>
                                      <div className="aspect-square w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                        {outputImageUrl ? (
                                          <img src={outputImageUrl} alt="output" className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                                            无输出图
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {stepTasks.length > 10 && (
                              <div className="text-center text-xs text-slate-500">
                                还有 {stepTasks.length - 10} 条任务，请在任务列表中查看
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
