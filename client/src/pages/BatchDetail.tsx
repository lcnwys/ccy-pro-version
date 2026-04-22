import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  success: '成功',
  failed: '失败',
};

const parseJson = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
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

const extractInputImageUrl = (inputData: string | null | undefined, apiBase?: string): string | null => {
  if (!inputData) return null;
  try {
    const input = JSON.parse(inputData);
    if (typeof input === 'object' && input !== null) {
      if (typeof input.referenceImageUrl === 'string' && input.referenceImageUrl.startsWith('http')) {
        return input.referenceImageUrl;
      }
      if (typeof input.referenceImageId === 'string' && apiBase) {
        return `${apiBase}/files/download/${input.referenceImageId}`;
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const fetchTasks = useCallback(async (showRefreshing = false) => {
    if (!batchId) return;
    if (showRefreshing) setRefreshing(true);

    try {
      const token = localStorage.getItem('token');

      if (batchId.startsWith('wr-')) {
        const runId = parseInt(batchId.slice(3), 10);
        const tasksRes = await fetch(`${API_BASE}/tasks?workflowRunId=${runId}&limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tasksData = await tasksRes.json();
        if (tasksData.success) {
          setTasks(tasksData.data.tasks || []);
        }
      } else {
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
      setRefreshing(false);
    }
  }, [batchId, API_BASE]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh for active tasks
  useEffect(() => {
    const hasActive = tasks.some((t) => t.status === 'pending' || t.status === 'processing');
    if (!hasActive) return;

    const timer = setInterval(() => {
      void fetchTasks(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [tasks, fetchTasks]);

  const handleRefreshResultUrl = async (taskId: number) => {
    try {
      const response = await apiClient.refreshTaskResultUrl(taskId);
      const updated = response.data.data as TaskRecord;
      setTasks((current) => current.map((t) => (t.id === updated.id ? updated : t)));
    } catch (error) {
      console.error('Failed to refresh task result url:', error);
    }
  };

  const handleSelectAll = () => {
    const successIds = tasks.filter((t) => t.status === 'success').map((t) => t.id);
    if (selectedIds.size === successIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(successIds));
    }
  };

  const handleToggleSelect = (taskId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleDownload = async (taskIds: number[], all: boolean) => {
    setDownloading(true);
    try {
      const targetIds = all
        ? tasks.filter((t) => t.status === 'success').map((t) => t.id)
        : taskIds;

      // 先批量刷新 URL 确保图片链接有效
      const token = localStorage.getItem('token');
      const refreshRes = await fetch(`${API_BASE}/tasks/batch-refresh-urls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds: targetIds }),
      });
      const refreshData = await refreshRes.json();
      const refreshedTasks = (refreshData.data || []) as TaskRecord[];

      // 合并刷新后的数据
      const taskMap = new Map(refreshedTasks.map((t) => [t.id, t]));
      const updatedTasks = tasks.map((t) => taskMap.get(t.id) || t);
      setTasks(updatedTasks);

      // 收集下载 URL
      const downloadUrls: Array<{ url: string; name: string }> = [];
      for (const task of updatedTasks.filter((t) => targetIds.includes(t.id))) {
        const outputUrl = task.result_url || extractImageUrl(task.output_data, ['tempUrl', 'imageUrl', 'url']);
        if (outputUrl) {
          downloadUrls.push({
            url: outputUrl,
            name: `result-${task.id}.jpg`,
          });
        }

        if (includeOriginal) {
          const inputUrl = extractInputImageUrl(task.input_data, API_BASE);
          if (inputUrl) {
            downloadUrls.push({
              url: inputUrl,
              name: `input-${task.id}.jpg`,
            });
          }
        }
      }

      // 逐个下载（浏览器限制，需要间隔触发）
      for (let i = 0; i < downloadUrls.length; i++) {
        const { url, name } = downloadUrls[i];
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (i < downloadUrls.length - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const total = tasks.length;
  const successCount = tasks.filter((t) => t.status === 'success').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;
  const processingCount = tasks.filter((t) => t.status === 'processing').length;
  const progress = total > 0 ? Math.round((successCount / total) * 100) : 0;
  const isWorkflowRun = tasks.some((t) => t.workflow_run_id);
  const firstTask = tasks[0];
  const allSuccessSelected = selectedIds.size > 0 && selectedIds.size === tasks.filter((t) => t.status === 'success').length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white px-8 py-12 text-center text-sm text-slate-500 shadow-sm">
          加载中...
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-6">
        <Link to="/tasks" className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          返回任务中心
        </Link>
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-8 py-16 text-center text-sm text-slate-500">
          该批次暂无任务
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回链接 */}
      <Link to="/tasks" className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        返回任务中心
      </Link>

      {/* 批次摘要 */}
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">
                {isWorkflowRun ? 'Workflow Batch' : 'Batch Detail'}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {isWorkflowRun
                  ? (firstTask.workflow_step_name || '工作流运行')
                  : (FUNCTION_NAMES[firstTask.function_type] || firstTask.function_type)
                }
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                批次 {batchId?.slice(0, 16)}... · {new Date(firstTask.created_at).toLocaleString('zh-CN')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void fetchTasks(true)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {refreshing ? '刷新中...' : '刷新状态'}
              </button>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-0 divide-x divide-slate-100 border-b border-slate-100">
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{total}</div>
            <div className="text-xs text-slate-500">总数</div>
          </div>
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{successCount}</div>
            <div className="text-xs text-emerald-600">成功</div>
          </div>
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-rose-600">{failedCount}</div>
            <div className="text-xs text-rose-600">失败</div>
          </div>
          <div className="px-6 py-4 text-center">
            <div className="text-2xl font-bold text-sky-600">{processingCount}</div>
            <div className="text-xs text-sky-600">处理中</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="px-6 py-4 lg:px-8">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>进度</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full transition-all ${failedCount > 0 ? 'bg-rose-500' : progress === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* 操作工具栏 */}
      <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSelectAll}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                allSuccessSelected
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {allSuccessSelected ? '取消全选' : '全选成功项'}
            </button>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={includeOriginal}
                onChange={(e) => setIncludeOriginal(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              包含原图
            </label>

            <div className="text-sm text-slate-500">
              已选 {selectedIds.size} / {successCount} 项
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={() => void handleDownload(Array.from(selectedIds), false)}
                disabled={downloading}
                className="rounded-xl border border-cyan-600/60 px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50"
              >
                {downloading ? '打包中...' : `下载选中 (${selectedIds.size})`}
              </button>
            )}
            <button
              onClick={() => void handleDownload([], true)}
              disabled={downloading || successCount === 0}
              className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {downloading ? '打包中...' : '下载全部'}
            </button>
          </div>
        </div>
      </section>

      {/* 任务网格 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => {
          const inputUrl = extractInputImageUrl(task.input_data, API_BASE);
          const outputUrl = task.result_url || extractImageUrl(task.output_data, ['tempUrl', 'imageUrl', 'url']);
          const isSelected = selectedIds.has(task.id);
          const isExpanded = expandedTaskId === task.id;
          const stepName = task.workflow_step_name;

          return (
            <div
              key={task.id}
              className={`overflow-hidden rounded-[24px] border bg-white shadow-sm transition ${
                isSelected ? 'border-cyan-400 ring-1 ring-cyan-200' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* 卡片头部 */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  {task.status === 'success' && (
                    <button
                      onClick={() => handleToggleSelect(task.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500 text-white'
                          : 'border-slate-300 bg-white hover:border-cyan-400'
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}
                  <span className="font-mono text-xs text-slate-500">#{task.id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  {stepName && (
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] text-cyan-700">{stepName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {task.status === 'success' && task.task_id_origin && (
                    <button
                      onClick={() => void handleRefreshResultUrl(task.id)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                      title="刷新结果图片"
                    >
                      刷新
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-50"
                  >
                    {isExpanded ? '收起' : '详情'}
                  </button>
                </div>
              </div>

              {/* 图片对比区 */}
              <div className="p-4">
                {task.status === 'failed' && task.error_message ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                    {task.error_message}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* 原图 */}
                    <div>
                      <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">原图</div>
                      <div
                        className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                        onClick={() => inputUrl && setPreviewUrl(inputUrl)}
                      >
                        {inputUrl ? (
                          <img src={inputUrl} alt="input" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">无输入图</div>
                        )}
                      </div>
                    </div>
                    {/* 结果图 */}
                    <div>
                      <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-400">结果</div>
                      <div
                        className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                        onClick={() => outputUrl && setPreviewUrl(outputUrl)}
                      >
                        {outputUrl ? (
                          <img src={outputUrl} alt="output" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            {task.status === 'processing' ? '处理中...' : '无结果图'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 成功任务的快捷操作 */}
                {task.status === 'success' && outputUrl && (
                  <div className="mt-3 flex items-center justify-between">
                    <a
                      href={outputUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      下载结果图
                    </a>
                    {task.cost != null && (
                      <span className="text-xs text-slate-500">{task.cost} 次元值</span>
                    )}
                  </div>
                )}
              </div>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/30 px-4 py-4">
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">功能类型</div>
                      <div className="mt-0.5 font-medium text-slate-900">{FUNCTION_NAMES[task.function_type] || task.function_type}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">上游 TaskId</div>
                      <div className="mt-0.5 truncate font-mono text-slate-900">{task.task_id_origin || '暂无'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="text-slate-400">创建时间</div>
                      <div className="mt-0.5 text-slate-900">{new Date(task.created_at).toLocaleString('zh-CN')}</div>
                    </div>
                    {task.completed_at && (
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <div className="text-slate-400">完成时间</div>
                        <div className="mt-0.5 text-slate-900">{new Date(task.completed_at).toLocaleString('zh-CN')}</div>
                      </div>
                    )}
                  </div>

                  {/* 输入参数 */}
                  {task.input_data && (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-slate-700">
                        输入参数
                        <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="mt-2 overflow-hidden rounded-xl bg-slate-950">
                        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 text-[11px] leading-5 text-slate-100">
                          {JSON.stringify(parseJson(task.input_data), null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}

                  {/* 原始响应 */}
                  {task.output_data && (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-slate-700">
                        原始响应
                        <span className="text-slate-400 transition group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="mt-2 overflow-hidden rounded-xl bg-slate-950">
                        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 text-[11px] leading-5 text-slate-100">
                          {JSON.stringify(parseJson(task.output_data), null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}

                  {/* 跳转到完整 TaskDetail */}
                  <Link
                    to={`/tasks/${task.id}${task.workflow_run_id ? `?workflowRunId=${task.workflow_run_id}` : ''}`}
                    className="block rounded-xl border border-cyan-200 bg-cyan-50 py-2 text-center text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
                  >
                    查看完整详情
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图片预览弹窗 */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0f172a] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="text-sm font-medium text-slate-200">图片预览</div>
              <div className="flex items-center gap-3">
                <a
                  href={previewUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-cyan-600/50 bg-cyan-600/20 px-4 py-1.5 text-sm text-cyan-300 transition hover:bg-cyan-600/30"
                >
                  下载图片
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="flex max-h-[80vh] min-h-[400px] items-center justify-center bg-slate-950 p-6">
              <img src={previewUrl} alt="preview" className="max-h-[72vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
