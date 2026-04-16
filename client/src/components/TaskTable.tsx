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

const summarizeInput = (inputRaw: string) => {
  try {
    const input = JSON.parse(inputRaw) as Record<string, unknown>;

    if (typeof input.prompt === 'string' && input.prompt.trim()) {
      return input.prompt.slice(0, 48);
    }

    const keys = Object.entries(input)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value).slice(0, 18)}`);

    return keys.length > 0 ? keys.join(' / ') : '无参数摘要';
  } catch {
    return '参数解析失败';
  }
};

interface TaskTableProps {
  tasks: TaskRecord[];
  showTeam?: boolean;
  showUser?: boolean;
  emptyText?: string;
}

export function TaskTable({
  tasks,
  showTeam = false,
  showUser = false,
  emptyText = '暂无任务数据',
}: TaskTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="px-4 py-3">任务</th>
              <th className="px-4 py-3">功能</th>
              {showTeam && <th className="px-4 py-3">团队</th>}
              {showUser && <th className="px-4 py-3">提交人</th>}
              <th className="px-4 py-3">批次</th>
              <th className="px-4 py-3">参数摘要</th>
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

              return (
                <tr key={task.id} className="align-top text-sm text-slate-700">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">#{task.id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {task.cost ? `${task.cost} 次元值` : '未计费'}
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
                  {showTeam && (
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{task.team_name || '平台模式'}</div>
                    </td>
                  )}
                  {showUser && (
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{task.user_nickname || '未命名用户'}</div>
                      <div className="mt-1 text-xs text-slate-500">{task.user_email}</div>
                    </td>
                  )}
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs text-slate-600">{task.batch_id.slice(0, 8)}</div>
                    <div className="mt-1 text-xs text-slate-500">{batchProgress}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-xs text-sm text-slate-700">{summarizeInput(task.input_data)}</div>
                    {task.error_message && (
                      <div className="mt-2 rounded-xl bg-rose-50 px-2 py-1 text-xs text-rose-700">
                        {task.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[task.status] || 'bg-slate-100 text-slate-800'}`}>
                      {task.status}
                    </span>
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
                      className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
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
