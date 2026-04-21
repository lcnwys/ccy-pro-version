import type { TaskListSummary } from '@/types';

interface TaskSummaryCardsProps {
  summary: TaskListSummary;
}

const CARD_META = [
  { key: 'total', label: '任务总数', tone: 'bg-slate-900 text-white' },
  { key: 'success', label: '成功', tone: 'bg-emerald-100 text-emerald-900' },
  { key: 'processing', label: '处理中', tone: 'bg-sky-100 text-sky-900' },
  { key: 'failed', label: '失败', tone: 'bg-rose-100 text-rose-900' },
  { key: 'batches', label: '批次', tone: 'bg-amber-100 text-amber-900' },
  { key: 'total_cost', label: '累计次元值', tone: 'bg-violet-100 text-violet-900' },
] as const;

export function TaskSummaryCards({ summary }: TaskSummaryCardsProps) {
  return (
    <div className="w-full grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {CARD_META.map((card) => (
        <div key={card.key} className={`rounded-2xl px-4 py-3 shadow-sm sm:rounded-3xl sm:px-4 sm:py-4 ${card.tone}`}>
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-70 sm:text-xs">{card.label}</div>
          <div className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-3xl">{summary[card.key]}</div>
        </div>
      ))}
    </div>
  );
}
