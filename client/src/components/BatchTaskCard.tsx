import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TaskRecord } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-200',
  processing: 'bg-sky-100 text-sky-900 border-sky-200',
  success: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  failed: 'bg-rose-100 text-rose-900 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  success: '成功',
  failed: '失败',
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

interface BatchTaskCardProps {
  batchId: string;
  functionType: string;
  tasks: TaskRecord[];
  createdAt: string;
  user_email?: string;
  user_nickname?: string;
  team_name?: string;
  showTeam?: boolean;
  showUser?: boolean;
}

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

export function BatchTaskCard({
  batchId,
  functionType,
  tasks,
  createdAt,
  user_email,
  user_nickname,
  team_name,
  showTeam = false,
  showUser = false,
}: BatchTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const total = tasks.length;
  const success = tasks.filter((t) => t.status === 'success').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const processing = tasks.filter((t) => t.status === 'processing').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;

  const overallStatus = failed > 0 ? 'failed' : pending === 0 && processing === 0 && success === total ? 'success' : 'processing';
  const progress = total > 0 ? Math.round((success / total) * 100) : 0;
  const statusColor = STATUS_COLORS[overallStatus] || STATUS_COLORS.pending;

  const firstTask = tasks[0];
  // previewUrl 保留供后续使用

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 头部：批次摘要 */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold border ${statusColor}`}>
              {STATUS_LABELS[overallStatus] || overallStatus}
            </span>
            <span className="font-semibold text-slate-900">
              批次 {batchId.slice(0, 12)}...
            </span>
            <span className="text-sm text-slate-600">
              {FUNCTION_NAMES[functionType] || functionType}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>进度：{success}/{total} ({progress}%)</span>
            {showUser && (
              <span>{user_nickname || user_email || '未命名'}</span>
            )}
            {showTeam && team_name && (
              <span>{team_name}</span>
            )}
            <span>{new Date(createdAt).toLocaleString('zh-CN')}</span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {isExpanded ? '收起' : `展开详情 (${total})`}
            </button>
            <Link
              to={`/batches/${batchId}`}
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              查看批次详情
            </Link>
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all ${overallStatus === 'failed' ? 'bg-rose-500' : overallStatus === 'success' ? 'bg-emerald-500' : 'bg-sky-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 展开后显示详细任务列表 */}
      {isExpanded && (
        <div className="px-4 py-4">
          <div className="space-y-3">
            {tasks.map((task) => {
              const taskPreviewUrl = extractPreviewUrl(task);
              const inputImageUrl = task.input_data ? (() => {
                try {
                  const input = JSON.parse(task.input_data) as Record<string, unknown>;
                  if (typeof input.referenceImageUrl === 'string' && input.referenceImageUrl.startsWith('http')) {
                    return input.referenceImageUrl;
                  }
                } catch {}
                return null;
              })() : null;

              return (
                <div key={task.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3">
                  <span className="w-12 text-xs font-mono text-slate-500">#{task.id}</span>
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  {/* 输入图 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">输入</span>
                    <div className="h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {inputImageUrl ? (
                        <img src={inputImageUrl} alt="input" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[8px] text-slate-400">无</div>
                      )}
                    </div>
                  </div>
                  {/* 箭头 */}
                  <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {/* 输出图 */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">输出</span>
                    <div className="h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {taskPreviewUrl ? (
                        <img src={taskPreviewUrl} alt="output" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[8px] text-slate-400">无</div>
                      )}
                    </div>
                  </div>
                  {/* 错误信息 */}
                  {task.error_message && (
                    <span className="flex-1 truncate text-xs text-rose-600">{task.error_message}</span>
                  )}
                  {/* 耗时 */}
                  {task.cost && (
                    <span className="text-xs text-slate-500">{task.cost} 次元值</span>
                  )}
                  {/* 链接 */}
                  <a
                    href={`/tasks/${task.id}`}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    详情
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
