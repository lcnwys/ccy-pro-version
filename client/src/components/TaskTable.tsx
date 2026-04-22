import { Link } from 'react-router-dom';
import type { TaskRecord } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  success: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-rose-100 text-rose-900',
};

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

const extractPreviewUrl = (task: TaskRecord) => {
  if (typeof task.result_url === 'string' && task.result_url.startsWith('http')) {
    return task.result_url;
  }

  if (!task.output_data) return null;

  try {
    const output = JSON.parse(task.output_data) as Record<string, unknown>;
    for (const key of ['tempUrl', 'imageUrl', 'url']) {
      const value = output[key];
      if (typeof value === 'string' && value.startsWith('http')) {
        return value;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const extractInputImageUrl = (task: TaskRecord, apiBase?: string) => {
  // 从 input_data 中获取原图
  if (!task.input_data) return null;

  try {
    const input = JSON.parse(task.input_data) as Record<string, unknown>;
    // 优先使用 URL
    if (typeof input.referenceImageUrl === 'string' && input.referenceImageUrl.startsWith('http')) {
      return input.referenceImageUrl;
    }
    // 或者使用 fileId（需要转换为下载 URL）
    if (typeof input.referenceImageId === 'string' && apiBase) {
      return `${apiBase}/files/download/${input.referenceImageId}`;
    }
  } catch {
    return null;
  }

  return null;
};

interface TaskTableProps {
  tasks: TaskRecord[];
  showTeam?: boolean;
  showUser?: boolean;
  emptyText?: string;
  apiBase?: string;
}

export function TaskTable({
  tasks,
  showUser = false,
  emptyText = '暂无任务数据',
  apiBase = '/api/v1',
}: Omit<TaskTableProps, 'showTeam'>) {
  if (tasks.length === 0) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-xs text-slate-500 sm:rounded-3xl sm:px-6 sm:py-12 sm:text-sm">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3">任务</th>
              <th className="px-4 py-3">任务类型</th>
              <th className="px-4 py-3">批次</th>
              {showUser && <th className="px-4 py-3">操作人</th>}
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const batchProgress = task.batch_total && task.batch_total > 1
                ? `${task.batch_success || 0}/${task.batch_total}`
                : '单任务';
              const previewUrl = extractPreviewUrl(task);
              const inputImageUrl = extractInputImageUrl(task, apiBase);

              return (
                <tr key={task.id} className="align-top text-sm text-slate-700">
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex gap-2">
                        {/* 原图 */}
                        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {inputImageUrl ? (
                            <img src={inputImageUrl} alt={`input-${task.id}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                              无原图
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-white text-center">
                            原图
                          </div>
                        </div>
                        {/* 结果图 */}
                        <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {previewUrl ? (
                            <img src={previewUrl} alt={`result-${task.id}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">
                              无结果
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-white text-center">
                            结果
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">#{task.id}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {task.cost ? `${task.cost} 次元值` : '未计费'}
                        </div>
                        {task.task_id_origin && (
                          <div className="mt-1 font-mono text-[10px] text-slate-400">
                            上游 {task.task_id_origin.slice(0, 12)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">
                      {FUNCTION_NAMES[task.function_type] || task.function_type}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{task.function_type}</div>
                    {task.workflow_step_name && (
                      <div className="mt-2 inline-flex rounded-full bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700">
                        Workflow · {task.workflow_step_name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs text-slate-600">{task.batch_id.slice(0, 10)}</div>
                    <div className="mt-1 text-xs text-slate-500">{batchProgress}</div>
                  </td>
                  {showUser && (
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{task.user_nickname || '未命名用户'}</div>
                      <div className="mt-1 text-xs text-slate-500">{task.user_email}</div>
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[task.status] || 'bg-slate-100 text-slate-800'}`}>
                      {task.status}
                    </span>
                    {task.error_message && (
                      <div className="mt-2 max-w-[180px] rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
                        {task.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    <div>{new Date(task.created_at).toLocaleString('zh-CN')}</div>
                    {task.completed_at && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        完成：{new Date(task.completed_at).toLocaleString('zh-CN')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
