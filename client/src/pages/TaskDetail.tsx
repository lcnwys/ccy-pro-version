import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { TaskTable } from '@/components/TaskTable';
import { apiClient } from '@/api';
import type { TaskRecord } from '@/types';

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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
};

const parseJson = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown> | string | string[];
  } catch {
    return raw;
  }
};

const extractInputImageUrl = (inputData: unknown, apiBase?: string): string | null => {
  if (!inputData) return null;

  try {
    const input = typeof inputData === 'string' ? JSON.parse(inputData) : inputData;
    if (typeof input === 'object' && input !== null) {
      // 优先使用 URL
      if (typeof input.referenceImageUrl === 'string' && input.referenceImageUrl.startsWith('http')) {
        return input.referenceImageUrl;
      }
      // 或者使用 fileId（需要转换为下载 URL）
      if (typeof input.referenceImageId === 'string' && apiBase) {
        return `${apiBase}/files/download/${input.referenceImageId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const extractImageUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string' && value.startsWith('http')) return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.startsWith('http'));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const urls: string[] = [];
    for (const key of ['imageUrl', 'tempUrl', 'url', 'mockUrl']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.startsWith('http')) {
        urls.push(candidate);
      }
    }
    for (const key of ['imageUrls', 'urls', 'tempUrls', 'images']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        urls.push(...candidate.filter((item): item is string => typeof item === 'string' && item.startsWith('http')));
      }
    }
    return urls;
  }
  return [];
};

interface PreviewCardProps {
  url: string;
  alt: string;
  title?: string;
  onPreview: (url: string) => void;
}

function PreviewCard({ url, alt, title, onPreview }: PreviewCardProps) {
  return (
    <button
      type="button"
      onClick={() => onPreview(url)}
      className="group mx-auto w-full max-w-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white text-left shadow-sm transition hover:border-cyan-300"
    >
      {title && <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">{title}</div>}
      <div className="flex h-[420px] w-full items-center justify-center bg-slate-50 p-6 xl:h-[520px]">
        <img
          src={url}
          alt={alt}
          className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
        />
      </div>
    </button>
  );
}

interface ComparisonCardProps {
  inputUrl: string;
  outputUrl: string;
  onPreview: (url: string) => void;
}

function ComparisonCard({ inputUrl, outputUrl, onPreview }: ComparisonCardProps) {
  return (
    <div className="mx-auto w-full max-w-[900px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        原图 → 结果对比
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        <div className="group cursor-pointer" onClick={() => onPreview(inputUrl)}>
          <div className="flex h-[400px] items-center justify-center bg-slate-50 p-4 xl:h-[500px]">
            <img
              src={inputUrl}
              alt="input"
              className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
            />
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
            原图
          </div>
        </div>
        <div className="group cursor-pointer" onClick={() => onPreview(outputUrl)}>
          <div className="flex h-[400px] items-center justify-center bg-slate-50 p-4 xl:h-[500px]">
            <img
              src={outputUrl}
              alt="output"
              className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
            />
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
            结果
          </div>
        </div>
      </div>
    </div>
  );
}

interface WorkflowTaskGroup {
  workflowName: string;
  workflowRunId: number;
  items: Array<{
    itemIndex: number;
    steps: TaskRecord[];
  }>;
}

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const workflowRunId = searchParams.get('workflowRunId');
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [batchTasks, setBatchTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingResultUrl, setRefreshingResultUrl] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [workflowView, setWorkflowView] = useState<{ enabled: boolean; groups: WorkflowTaskGroup[] } | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const fetchTask = async (showRefreshing = false) => {
    if (!id) return;
    if (showRefreshing) setRefreshing(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        const currentTask = data.data as TaskRecord;
        setTask(currentTask);

        if (currentTask.batch_id) {
          const progressResponse = await fetch(`${API_BASE}/tasks/${currentTask.batch_id}/progress`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const progressData = await progressResponse.json();
          if (progressData.success) {
            setBatchTasks(progressData.data.tasks || []);
          }
        }

        // 如果是工作流任务，获取完整的工作流运行详情
        if (workflowRunId) {
          const workflowRunResponse = await fetch(`${API_BASE}/workflows/runs/${workflowRunId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const workflowRunData = await workflowRunResponse.json();

          if (workflowRunData.success) {
            // 获取该工作流运行下的所有任务
            const tasksResponse = await apiClient.getTasks({
              workflowRunId: parseInt(workflowRunId),
              limit: 200,
            });
            const workflowTasks = tasksResponse.data.data?.tasks || [];

            // 按 itemIndex 分组
            const itemMap = new Map<number, TaskRecord[]>();
            for (const t of workflowTasks) {
              const itemIndex = t.workflow_item_index as number | undefined;
              if (itemIndex !== undefined) {
                const existing = itemMap.get(itemIndex) || [];
                existing.push(t);
                itemMap.set(itemIndex, existing);
              }
            }

            const groups: WorkflowTaskGroup[] = [{
              workflowName: workflowRunData.data.workflow_name || `工作流 #${workflowRunId}`,
              workflowRunId: parseInt(workflowRunId),
              items: Array.from(itemMap.entries())
                .sort(([a], [b]) => a - b)
                .map(([itemIndex, steps]) => ({
                  itemIndex,
                  steps: steps.sort((a, b) => (a.workflow_item_index as number) - (b.workflow_item_index as number)),
                })),
            }];

            setWorkflowView({ enabled: true, groups });
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch task detail:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTask();
  }, [id]);

  useEffect(() => {
    if (!task || (task.status !== 'pending' && task.status !== 'processing')) {
      return;
    }

    const timer = setInterval(() => {
      void fetchTask(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [task?.id, task?.status]);

  const parsedInput = useMemo(() => parseJson(task?.input_data), [task?.input_data]);
  const parsedOutput = useMemo(() => parseJson(task?.output_data), [task?.output_data]);
  const inputImageUrl = useMemo(() => extractInputImageUrl(parsedInput, API_BASE), [parsedInput, API_BASE]);
  const imageUrls = useMemo(() => extractImageUrls(parsedOutput), [parsedOutput]);
  const batchPeers = batchTasks.filter((item) => item.id !== task?.id);

  const handleRefreshResultUrl = async () => {
    if (!task) return;

    setRefreshingResultUrl(true);
    try {
      const response = await apiClient.refreshTaskResultUrl(task.id);
      setTask(response.data.data as TaskRecord);
    } catch (error) {
      console.error('Failed to refresh task result url:', error);
    } finally {
      setRefreshingResultUrl(false);
    }
  };

  useEffect(() => {
    if (!task || task.status !== 'success') return;
    if (imageUrls.length > 0) return;
    if (!task.task_id_origin) return;

    void handleRefreshResultUrl();
  }, [task?.id, task?.status, task?.task_id_origin, imageUrls.length]);

  if (loading) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-sm">
        正在加载任务详情...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
        <div className="text-2xl font-semibold text-slate-900">任务不存在</div>
        <Link to="/tasks" className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
          返回任务中心
        </Link>
      </div>
    );
  }

  const batchTotal = task.batch_total || batchTasks.length || 1;
  const hasPreview = imageUrls.length > 0;
  const createdAtText = new Date(task.created_at).toLocaleString('zh-CN');
  const isWorkflowTask = workflowView?.enabled && workflowView.groups.length > 0;

  return (
    <div className="space-y-6">
      {/* 工作流执行结果展示 */}
      {isWorkflowTask && (
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">Workflow Execution</div>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  {workflowView.groups[0].workflowName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  工作流 ID: #{workflowView.groups[0].workflowRunId} · 共 {workflowView.groups[0].items.length} 项输入
                </p>
              </div>
              <Link
                to={`/workflows/runs/${workflowView.groups[0].workflowRunId}`}
                className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
              >
                查看完整运行详情
              </Link>
            </div>
          </div>

          <div className="divide-y divide-slate-100 bg-slate-50 p-6">
            {workflowView.groups[0].items.map((item) => {
              const allSuccess = item.steps.every((s) => s.status === 'success');
              const hasFailed = item.steps.some((s) => s.status === 'failed');
              const completedSteps = item.steps.filter((s) => s.status === 'success').length;

              return (
                <div key={item.itemIndex} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="font-medium text-slate-900">
                      输入 #{item.itemIndex + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      {allSuccess ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          完成 {completedSteps}/{item.steps.length} 步骤
                        </span>
                      ) : hasFailed ? (
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
                          失败
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                          执行中 {completedSteps}/{item.steps.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 步骤流程图 */}
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    {item.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-center">
                        {idx > 0 && <div className="mx-2 h-px w-6 bg-slate-300" />}
                        <div
                          className={`flex min-w-[120px] flex-col items-center rounded-xl border px-3 py-2 ${
                            step.status === 'success'
                              ? 'border-emerald-200 bg-emerald-50'
                              : step.status === 'failed'
                              ? 'border-rose-200 bg-rose-50'
                              : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="text-xs text-slate-600">{step.workflow_step_name || FUNCTION_NAMES[step.function_type]}</div>
                          <div className="mt-1 text-sm">
                            {step.status === 'success' && '✅'}
                            {step.status === 'failed' && '❌'}
                            {step.status === 'processing' && '⚙️'}
                            {step.status === 'pending' && '⏳'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 结果预览 */}
                  {item.steps.some((s) => {
                    const urls = extractImageUrls(parseJson(s.output_data));
                    return urls.length > 0 && s.status === 'success';
                  }) && (
                    <div className="grid grid-cols-3 gap-3">
                      {item.steps
                        .filter((s) => {
                          const urls = extractImageUrls(parseJson(s.output_data));
                          return urls.length > 0 && s.status === 'success';
                        })
                        .map((step) => {
                          const urls = extractImageUrls(parseJson(step.output_data));
                          const previewUrl = urls[0];
                          if (!previewUrl) return null;

                          return (
                            <div key={step.id} className="space-y-1">
                              <div className="text-xs text-slate-500">{step.workflow_step_name || FUNCTION_NAMES[step.function_type]}</div>
                              <div
                                className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                onClick={() => setPreviewImageUrl(previewUrl)}
                              >
                                <img
                                  src={previewUrl}
                                  alt={step.workflow_step_name || step.function_type}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* 错误信息 */}
                  {item.steps.some((s) => s.error_message) && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {item.steps.find((s) => s.error_message)?.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur xl:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Task Detail</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900 xl:text-4xl">
              #{task.id} {FUNCTION_NAMES[task.function_type] || task.function_type}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className={`rounded-full px-3 py-1 font-semibold ${STATUS_STYLES[task.status] || 'bg-slate-100 text-slate-800'}`}>
                {task.status}
              </span>
              <span className="truncate">批次：{task.batch_id}</span>
              <span>创建于：{createdAtText}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void fetchTask(true)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {refreshing ? '刷新中...' : '刷新详情'}
            </button>
            {task.status === 'success' && task.task_id_origin && (
              <button
                onClick={() => void handleRefreshResultUrl()}
                className="rounded-full border border-cyan-200 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50"
              >
                {refreshingResultUrl ? '刷新图片中...' : '刷新结果图片'}
              </button>
            )}
            {(task.status === 'failed' || task.status === 'success') && (
              <button
                onClick={async () => {
                  try {
                    const response = await apiClient.retryTask(task.id);
                    const newTask = response.data.data;
                    alert(`重试成功，新任务 #${newTask.id} 已创建`);
                  } catch (error) {
                    alert(error instanceof Error ? error.message : '重试失败');
                  }
                }}
                className="rounded-full border border-cyan-600 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
              >
                重试
              </button>
            )}
            <Link
              to="/tasks"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              任务中心
            </Link>
            <Link
              to={`/function/${task.function_type}`}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              返回功能页
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">团队</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.team_name || '平台模式'}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">提交人</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.user_nickname || task.user_email || '未知用户'}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">批次规模</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{batchTotal}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">消耗次元值</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.cost || 0}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm md:col-span-2 xl:col-span-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">上游 TaskId</div>
          <div className="mt-3 break-all font-mono text-sm font-semibold text-slate-900">{task.task_id_origin || '暂无'}</div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="space-y-6 xl:col-span-8">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">结果预览</h3>
                <p className="mt-1 text-sm text-slate-500">输出区只展示最终结果，点击图片可站内放大预览。</p>
              </div>
              {hasPreview && (
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {imageUrls.length} 张结果图
                </div>
              )}
            </div>

            {task.status === 'failed' && task.error_message ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm leading-6 text-rose-700">
                {task.error_message}
              </div>
            ) : hasPreview ? (
              <div className="mt-5 space-y-5">
                {/* 原图对比视图 */}
                {inputImageUrl && imageUrls.length > 0 && (
                  <ComparisonCard
                    inputUrl={inputImageUrl}
                    outputUrl={imageUrls[0]}
                    onPreview={setPreviewImageUrl}
                  />
                )}
                {/* 仅结果图视图（没有原图时） */}
                {!inputImageUrl && (
                  <div className={`grid gap-5 ${imageUrls.length > 1 ? '2xl:grid-cols-2' : 'grid-cols-1'}`}>
                    {imageUrls.map((url, index) => (
                      <PreviewCard
                        key={url}
                        url={url}
                        alt="task result"
                        title={imageUrls.length > 1 ? `结果图 ${index + 1}` : '结果图'}
                        onPreview={setPreviewImageUrl}
                      />
                    ))}
                  </div>
                )}
                {/* 多张结果图，且有原图时，额外显示结果图列表 */}
                {inputImageUrl && imageUrls.length > 1 && (
                  <div>
                    <div className="mb-3 text-sm font-medium text-slate-700">更多结果图</div>
                    <div className="grid gap-5 2xl:grid-cols-2">
                      {imageUrls.slice(1).map((url, index) => (
                        <PreviewCard
                          key={url}
                          url={url}
                          alt={`task result ${index + 2}`}
                          title={`结果图 ${index + 2}`}
                          onPreview={setPreviewImageUrl}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
                当前还没有可预览的结果图。
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">同批次任务</h3>
                <p className="mt-1 text-sm text-slate-500">批量任务时可直接看到同一批次其他子任务的执行情况。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                当前批次共 {batchTotal} 条
              </div>
            </div>

            <div className="mt-5">
              <TaskTable tasks={batchPeers} emptyText="当前任务所属批次暂无其他子任务" />
            </div>
          </section>
        </section>

        <aside className="space-y-6 xl:col-span-4">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">任务信息</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-slate-400">任务编号</dt>
                <dd className="mt-1 font-semibold text-slate-900">#{task.id}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-slate-400">功能类型</dt>
                <dd className="mt-1 font-semibold text-slate-900">{FUNCTION_NAMES[task.function_type] || task.function_type}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-slate-400">创建时间</dt>
                <dd className="mt-1 font-semibold text-slate-900">{createdAtText}</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <dt className="text-slate-400">当前状态</dt>
                <dd className="mt-1 font-semibold text-slate-900">{task.status}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-slate-900">
                输入参数
                <span className="text-sm font-medium text-slate-400 transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
                <pre className="overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-6 text-slate-100">{JSON.stringify(parsedInput, null, 2)}</pre>
              </div>
            </details>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-slate-900">
                原始响应
                <span className="text-sm font-medium text-slate-400 transition group-open:rotate-180">⌄</span>
              </summary>
              <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950">
                <pre className="overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-6 text-slate-100">{JSON.stringify(parsedOutput, null, 2)}</pre>
              </div>
            </details>
          </section>
        </aside>
      </div>

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0f172a] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-sm font-medium text-slate-200">图片预览</div>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
              >
                关闭
              </button>
            </div>
            <div className="flex max-h-[80vh] min-h-[420px] items-center justify-center bg-slate-950 p-6">
              <img
                src={previewImageUrl}
                alt="preview"
                className="max-h-[72vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
