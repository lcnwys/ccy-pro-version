import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TaskSummaryCards } from '@/components/TaskSummaryCards';
import { TaskTable } from '@/components/TaskTable';
import { apiClient } from '@/api';
import type { TaskFunctionSummaryItem, TaskListSummary, TaskRecord, WorkflowRecord, WorkflowRunRecord } from '@/types';

const EMPTY_SUMMARY: TaskListSummary = {
  total: 0,
  pending: 0,
  processing: 0,
  success: 0,
  failed: 0,
  batches: 0,
  users: 0,
  teams: 0,
  total_cost: 0,
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

type ScopeMode = 'mine' | 'team' | 'platform';

export function Tasks() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [summary, setSummary] = useState<TaskListSummary>(EMPTY_SUMMARY);
  const [functionSummary, setFunctionSummary] = useState<TaskFunctionSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('functionType') || '');
  const [workflowFilter, setWorkflowFilter] = useState<number | ''>(() => {
    const value = searchParams.get('workflowId');
    return value ? Number(value) : '';
  });
  const [workflowRunFilter, setWorkflowRunFilter] = useState<number | ''>(() => {
    const value = searchParams.get('workflowRunId');
    return value ? Number(value) : '';
  });
  const [workflowStepFilter, setWorkflowStepFilter] = useState(searchParams.get('workflowStepKey') || '');
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [page, setPage] = useState(() => Number(searchParams.get('page') || '1'));
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRunRecord[]>([]);
  const [scope, setScope] = useState<ScopeMode>(() => {
    const queryScope = searchParams.get('scope');
    if (queryScope === 'mine' || queryScope === 'team' || queryScope === 'platform') {
      return queryScope;
    }
    if (user?.role === 'super_admin') return 'platform';
    if (user?.is_team_admin) return 'team';
    return 'mine';
  });
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>(() => {
    const value = searchParams.get('teamId');
    return value ? Number(value) : user?.team_id ?? '';
  });

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

  const canViewTeamScope = Boolean(user?.is_team_admin || user?.role === 'super_admin');
  const canViewPlatformScope = user?.role === 'super_admin';
  const showTeamColumn = scope === 'platform';
  const showUserColumn = scope !== 'mine';

  const teamOptions = useMemo(() => user?.teams || [], [user?.teams]);

  useEffect(() => {
    if (!canViewTeamScope && scope !== 'mine') {
      setScope('mine');
    }
  }, [canViewTeamScope, scope]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('scope', scope);
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('functionType', typeFilter);
    if (workflowFilter !== '') params.set('workflowId', String(workflowFilter));
    if (workflowRunFilter !== '') params.set('workflowRunId', String(workflowRunFilter));
    if (workflowStepFilter) params.set('workflowStepKey', workflowStepFilter);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (selectedTeamId !== '') params.set('teamId', String(selectedTeamId));
    setSearchParams(params, { replace: true });
  }, [
    page,
    scope,
    statusFilter,
    typeFilter,
    workflowFilter,
    workflowRunFilter,
    workflowStepFilter,
    keyword,
    selectedTeamId,
    setSearchParams,
  ]);

  useEffect(() => {
    fetchTasks();
  }, [page, statusFilter, typeFilter, scope, selectedTeamId, workflowFilter, workflowRunFilter, workflowStepFilter]);

  useEffect(() => {
    void fetchWorkflowMeta();
  }, []);

  useEffect(() => {
    if (workflowFilter === '') {
      setWorkflowRunFilter('');
    }
  }, [workflowFilter]);

  const fetchTasks = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        scope,
      });

      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('functionType', typeFilter);
      if (workflowFilter !== '') params.append('workflowId', String(workflowFilter));
      if (workflowRunFilter !== '') params.append('workflowRunId', String(workflowRunFilter));
      if (workflowStepFilter) params.append('workflowStepKey', workflowStepFilter);
      if (keyword.trim()) params.append('keyword', keyword.trim());
      if (selectedTeamId !== '') params.append('teamId', String(selectedTeamId));

      const response = await fetch(`${API_BASE}/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setTasks(data.data.tasks || []);
        setSummary(data.data.summary || EMPTY_SUMMARY);
        setFunctionSummary(data.data.functionSummary || []);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowMeta = async () => {
    try {
      const [workflowRes, runRes] = await Promise.all([
        apiClient.getWorkflows(),
        apiClient.getWorkflowRuns(),
      ]);

      setWorkflows(workflowRes.data.data || []);
      setWorkflowRuns(runRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch workflow meta:', error);
    }
  };

  const filteredRuns = useMemo(() => {
    if (workflowFilter === '') return workflowRuns;
    return workflowRuns.filter((run) => run.workflow_id === workflowFilter);
  }, [workflowFilter, workflowRuns]);

  const availableSteps = useMemo(() => {
    if (workflowFilter === '') {
      return Array.from(
        new Map(
          workflows.flatMap((workflow) => workflow.steps.map((step) => [step.key, step]))
        ).values()
      );
    }

    return workflows.find((workflow) => workflow.id === workflowFilter)?.steps || [];
  }, [workflowFilter, workflows]);

  const workflowTaskCount = tasks.filter((task) => task.workflow_run_id).length;

  const handleSearch = () => {
    setPage(1);
    void fetchTasks();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Task Center</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">任务中心</h2>
            <p className="mt-2 text-sm text-slate-500">
              成员默认看自己的任务，团队管理员可以切团队范围，超级管理员可以看整个平台汇总。
            </p>
          </div>
          <Link to="/" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            去创建新任务
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">范围</label>
              <select
                value={scope}
                onChange={(event) => {
                  const nextScope = event.target.value as ScopeMode;
                  setScope(nextScope);
                  if (nextScope === 'mine') {
                    setSelectedTeamId(user?.team_id ?? '');
                  }
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="mine">我的任务</option>
                {canViewTeamScope && <option value="team">团队任务</option>}
                {canViewPlatformScope && <option value="platform">全平台任务</option>}
              </select>
            </div>

            {(scope === 'team' || scope === 'platform') && (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">团队</label>
                <select
                  value={selectedTeamId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedTeamId(value ? Number(value) : '');
                    setPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {scope === 'platform' && <option value="">全部团队</option>}
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">状态</label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">全部状态</option>
                <option value="pending">等待中</option>
                <option value="processing">处理中</option>
                <option value="success">成功</option>
                <option value="failed">失败</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">功能</label>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">全部功能</option>
                {Object.entries(FUNCTION_NAMES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</label>
              <select
                value={workflowFilter}
                onChange={(event) => {
                  setWorkflowFilter(event.target.value ? Number(event.target.value) : '');
                  setWorkflowStepFilter('');
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">全部任务</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Run</label>
              <select
                value={workflowRunFilter}
                onChange={(event) => {
                  setWorkflowRunFilter(event.target.value ? Number(event.target.value) : '');
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">全部运行</option>
                {filteredRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    #{run.id} · {run.workflow_name || `Workflow ${run.workflow_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">步骤</label>
              <select
                value={workflowStepFilter}
                onChange={(event) => {
                  setWorkflowStepFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <option value="">全部步骤</option>
                {availableSteps.map((step) => (
                  <option key={step.key} value={step.key}>
                    {step.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">搜索</label>
            <div className="flex gap-3">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="搜任务 ID、批次号、提交邮箱"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              />
              <button
                onClick={handleSearch}
                className="rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800"
              >
                查询
              </button>
            </div>
          </div>
        </div>
      </section>

      <TaskSummaryCards summary={summary} />

      {(workflowFilter !== '' || workflowRunFilter !== '' || workflowStepFilter) && (
        <section className="rounded-[28px] border border-cyan-200 bg-cyan-50/80 px-5 py-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              当前筛到的 workflow 任务 {workflowTaskCount} 条，普通任务 {tasks.length - workflowTaskCount} 条。
            </div>
            <button
              onClick={() => {
                setWorkflowFilter('');
                setWorkflowRunFilter('');
                setWorkflowStepFilter('');
                setPage(1);
              }}
              className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50"
            >
              清空 Workflow 筛选
            </button>
          </div>
        </section>
      )}

      <section className="grid gap-6 2xl:grid-cols-[1.35fr,0.65fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">任务列表</h3>
            <div className="text-sm text-slate-500">
              第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页，共 {pagination.total} 条
            </div>
          </div>

          {loading ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500">
              正在加载任务列表...
            </div>
          ) : (
            <TaskTable
              tasks={tasks}
              showTeam={showTeamColumn}
              showUser={showUserColumn}
              emptyText="当前筛选条件下暂无任务"
            />
          )}

          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <div className="text-sm text-slate-500">当前第 {page} 页</div>
              <button
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                disabled={page === pagination.totalPages}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">功能分布</h3>
            <div className="mt-4 space-y-3">
              {functionSummary.length === 0 ? (
                <div className="text-sm text-slate-500">暂无汇总数据</div>
              ) : (
                functionSummary.map((item) => (
                  <div key={item.function_type} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-900">
                        {FUNCTION_NAMES[item.function_type] || item.function_type}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{item.total}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      成功 {item.success} / 失败 {item.failed} / 消耗 {item.total_cost}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
