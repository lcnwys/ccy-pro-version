import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TaskTable } from '@/components/TaskTable';
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

const extractImageUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === 'string' && value.startsWith('http')) return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.startsWith('http'));
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const urls: string[] = [];
    for (const key of ['imageUrl', 'tempUrl', 'url']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.startsWith('http')) {
        urls.push(candidate);
      }
    }
    for (const key of ['imageUrls', 'urls', 'tempUrls']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        urls.push(...candidate.filter((item): item is string => typeof item === 'string' && item.startsWith('http')));
      }
    }
    return urls;
  }
  return [];
};

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [batchTasks, setBatchTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

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
  const imageUrls = useMemo(() => extractImageUrls(parsedOutput), [parsedOutput]);
  const batchPeers = batchTasks.filter((item) => item.id !== task?.id);

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

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Task Detail</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">
              #{task.id} {FUNCTION_NAMES[task.function_type] || task.function_type}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className={`rounded-full px-3 py-1 font-semibold ${STATUS_STYLES[task.status] || 'bg-slate-100 text-slate-800'}`}>
                {task.status}
              </span>
              <span>批次：{task.batch_id}</span>
              <span>创建于：{new Date(task.created_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => void fetchTask(true)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {refreshing ? '刷新中...' : '刷新详情'}
            </button>
            <Link
              to={`/function/${task.function_type}`}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              返回功能页
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">团队</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.team_name || '平台模式'}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">提交人</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.user_nickname || task.user_email || '未知用户'}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">批次规模</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{batchTotal}</div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">消耗次元值</div>
          <div className="mt-3 text-lg font-semibold text-slate-900">{task.cost || 0}</div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">输入参数</h3>
          <div className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            <pre>{JSON.stringify(parsedInput, null, 2)}</pre>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">输出结果</h3>
          {task.status === 'failed' && task.error_message ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {task.error_message}
            </div>
          ) : (
            <>
              {imageUrls.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img src={url} alt="task result" className="h-48 w-full object-cover transition group-hover:scale-[1.02]" />
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                <pre>{JSON.stringify(parsedOutput, null, 2)}</pre>
              </div>
            </>
          )}
        </section>
      </div>

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
    </div>
  );
}
