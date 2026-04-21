import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  success: '成功',
  failed: '失败',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
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

export function BatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

  useEffect(() => {
    fetchBatchDetail();
  }, [batchId]);

  const fetchBatchDetail = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 检查是否是 workflow_run
      if (batchId?.startsWith('wr-')) {
        const runId = parseInt(batchId.slice(3), 10);
        const runRes = await fetch(`${API_BASE}/workflows/runs/${runId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const runData = await runRes.json();
        if (runData.success) {
          setWorkflowRun(runData.data);
        }

        // 获取该工作流运行关联的所有任务
        const tasksRes = await fetch(`${API_BASE}/tasks?workflowRunId=${runId}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tasksData = await tasksRes.json();
        if (tasksData.success) {
          setTasks(tasksData.data.tasks || []);
        }
      } else {
        // 普通批次任务
        const progressRes = await fetch(`${API_BASE}/tasks/${batchId}/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const progressData = await progressRes.json();
        if (progressData.success) {
          setTasks(progressData.data.tasks || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch batch detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-slate-500">加载中...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="m-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-12 text-center text-sm text-slate-500">
        该批次暂无任务
      </div>
    );
  }

  const total = tasks.length;
  const success = tasks.filter((t) => t.status === 'success').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const processing = tasks.filter((t) => t.status === 'processing').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const progress = total > 0 ? Math.round((success / total) * 100) : 0;

  const overallStatus = failed > 0 ? 'failed' : pending === 0 && processing === 0 && success === total ? 'success' : 'processing';
  const statusColor = STATUS_COLORS[overallStatus] || STATUS_COLORS.pending;

  const firstTask = tasks[0];
  const isWorkflowRun = tasks.some((t) => t.workflow_run_id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* 返回链接 */}
      <Link
        to="/tasks"
        className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回任务中心
      </Link>

      {/* 批次摘要 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              批次 {batchId?.slice(0, 12)}...
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isWorkflowRun ? '工作流运行' : FUNCTION_NAMES[firstTask?.function_type] || firstTask?.function_type}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold border ${statusColor}`}>
            {STATUS_LABELS[overallStatus]}
          </span>
        </div>

        {/* 进度统计 */}
        <div className="mt-4 grid grid-cols-4 gap-4 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-2xl font-bold text-slate-900">{total}</div>
            <div className="text-xs text-slate-500">总数</div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-2xl font-bold text-emerald-600">{success}</div>
            <div className="text-xs text-emerald-600">成功</div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3">
            <div className="text-2xl font-bold text-rose-600">{failed}</div>
            <div className="text-xs text-rose-600">失败</div>
          </div>
          <div className="rounded-xl bg-sky-50 p-3">
            <div className="text-2xl font-bold text-sky-600">{processing}</div>
            <div className="text-xs text-sky-600">处理中</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-slate-600">
            <span>进度</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${overallStatus === 'failed' ? 'bg-rose-500' : overallStatus === 'success' ? 'bg-emerald-500' : 'bg-sky-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const inputImageUrl = extractImageUrl(task.input_data, ['referenceImageUrl', 'imageUrl', 'image']);
          const outputImageUrl = task.result_url || extractImageUrl(task.output_data, ['tempUrl', 'imageUrl', 'url']);
          const stepName = task.workflow_step_name;

          return (
            <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-600">#{task.id}</span>
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  {stepName && (
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">
                      {stepName}
                    </span>
                  )}
                </div>
                {task.cost && (
                  <span className="text-sm text-slate-500">{task.cost} 次元值</span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-6">
                {/* 输入图 */}
                <div className="flex-1">
                  <div className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-400">输入</div>
                  <div className="aspect-square w-32 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {inputImageUrl ? (
                      <img src={inputImageUrl} alt="input" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        无输入图
                      </div>
                    )}
                  </div>
                </div>

                {/* 箭头 */}
                <svg className="h-8 w-8 flex-shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>

                {/* 输出图 */}
                <div className="flex-1">
                  <div className="mb-2 text-xs uppercase tracking-[0.1em] text-slate-400">输出</div>
                  <div className="aspect-square w-32 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {outputImageUrl ? (
                      <img src={outputImageUrl} alt="output" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        无输出图
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 错误信息 */}
              {task.error_message && (
                <div className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                  {task.error_message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
