import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TaskSummaryCards } from '@/components/TaskSummaryCards';
import { WorkflowRunCard } from '@/components/WorkflowRunCard';
import { BatchTaskCard } from '@/components/BatchTaskCard';
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
  const [viewMode, setViewMode] = useState<'all' | 'workflow-runs' | 'batches'>('all');
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
    if (viewMode === 'all' || viewMode === 'workflow-runs') {
      fetchAllData();
    } else {
      fetchTasks();
    }
  }, [page, statusFilter, typeFilter, scope, selectedTeamId, workflowFilter, workflowRunFilter, workflowStepFilter, viewMode]);

  useEffect(() => {
    void fetchWorkflowMeta();
  }, []);

  useEffect(() => {
    if (workflowFilter === '') {
      setWorkflowRunFilter('');
    }
  }, [workflowFilter]);

  const fetchWorkflowRuns = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (workflowFilter !== '') params.append('workflowId', String(workflowFilter));

      const response = await fetch(`${API_BASE}/workflow-runs/aggregated?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setWorkflowRuns(data.data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch workflow runs:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page),
        limit: '100', // 获取更多任务用于聚合
        scope,
      });

      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('functionType', typeFilter);
      if (workflowFilter !== '') params.append('workflowId', String(workflowFilter));
      if (workflowRunFilter !== '') params.append('workflowRunId', String(workflowRunFilter));
      if (workflowStepFilter) params.append('workflowStepKey', workflowStepFilter);
      if (keyword.trim()) params.append('keyword', keyword.trim());
      if (selectedTeamId !== '') params.append('teamId', String(selectedTeamId));

      // 并行获取工作流运行和任务列表
      const workflowIdParam = workflowFilter !== '' ? String(workflowFilter) : '';
      const [runsRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/workflow-runs/aggregated?${new URLSearchParams(workflowIdParam ? { workflowId: workflowIdParam } : {}).toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/tasks?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const runsData = await runsRes.json();
      const tasksData = await tasksRes.json();

      if (runsData.success) {
        setWorkflowRuns(runsData.data.runs || []);
      }
      if (tasksData.success) {
        setTasks(tasksData.data.tasks || []);
        setSummary(tasksData.data.summary || EMPTY_SUMMARY);
        setFunctionSummary(tasksData.data.functionSummary || []);
        setPagination(tasksData.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'workflow-runs') {
      void fetchWorkflowRuns();
    }
  }, [viewMode]);

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
    <div className="w-full space-y-4 sm:space-y-6">
      <section className="w-full rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-lg backdrop-blur sm:rounded-[32px] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-700">Task Center</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:mt-3 sm:text-3xl">任务中心</h2>
            <p className="mt-2 text-sm text-slate-500">
              成员默认看自己的任务，团队管理员可以切团队范围，超级管理员可以看整个平台汇总。
            </p>
          </div>
          <Link to="/" className="w-full sm:w-auto rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:px-5 sm:py-3 sm:text-sm">
            去创建新任务
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">范围</label>
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

          <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 p-3 sm:rounded-[28px] sm:p-4">
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">搜索</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder="搜任务 ID、批次号、提交邮箱"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 sm:rounded-2xl sm:py-3"
              />
              <button
                onClick={handleSearch}
                className="w-full rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-cyan-800 sm:w-auto sm:rounded-2xl sm:px-5 sm:py-3 sm:text-sm"
              >
                查询
              </button>
            </div>
          </div>
        </div>
      </section>

      <TaskSummaryCards summary={summary} />

      {(workflowFilter !== '' || workflowRunFilter !== '' || workflowStepFilter) && (
        <section className="w-full rounded-[20px] border border-cyan-200 bg-cyan-50/80 px-4 py-3 text-sm text-slate-700 sm:rounded-[28px] sm:px-5 sm:py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

      <section className="grid gap-4 2xl:grid-cols-[1.35fr,0.65fr]">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">任务列表</h3>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  onClick={() => setViewMode('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setViewMode('workflow-runs')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === 'workflow-runs'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  工作流
                </button>
                <button
                  onClick={() => setViewMode('batches')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    viewMode === 'batches'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  批量任务
                </button>
              </div>
              <div className="text-xs text-slate-500 sm:text-sm">
                第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页，共 {pagination.total} 条
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-12 text-center text-xs text-slate-500 sm:rounded-[28px] sm:px-6 sm:py-20 sm:text-sm">
              正在加载列表...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 工作流运行展示 */}
              {(viewMode === 'all' || viewMode === 'workflow-runs') && workflowRuns.length > 0 && (
                <>
                  {viewMode === 'all' && (
                    <h4 className="text-sm font-semibold text-slate-700">工作流运行</h4>
                  )}
                  {workflowRuns.map((run) => {
                    const runTasks = tasks.filter((t) => t.workflow_run_id === run.id);
                    const workflow = workflows.find((w) => w.id === run.workflow_id);
                    return (
                      <WorkflowRunCard
                        key={run.id}
                        run={run}
                        tasks={runTasks.map(t => ({
                          id: t.id,
                          workflow_step_key: t.workflow_step_key || '',
                          workflow_step_name: t.workflow_step_name || '',
                          status: t.status,
                          input_data: t.input_data,
                          output_data: t.output_data,
                          result_url: t.result_url,
                          error_message: t.error_message,
                          created_at: t.created_at,
                          completed_at: t.completed_at,
                        }))}
                        workflowSteps={workflow?.steps}
                      />
                    );
                  })}
                </>
              )}

              {/* 普通批次任务展示 */}
              {(viewMode === 'all' || viewMode === 'batches') && (
                <>
                  {viewMode === 'all' && workflowRuns.length > 0 && (
                    <h4 className="mt-6 text-sm font-semibold text-slate-700">批量任务</h4>
                  )}
                  {(() => {
                    // 按 batch_id 聚合任务
                    const batches = new Map<string, TaskRecord[]>();
                    const workflowTaskBatchIds = new Set<string>();

                    // 先收集所有属于工作流的 batch_id（这些不需要显示）
                    tasks.forEach((t) => {
                      if (t.workflow_run_id) {
                        workflowTaskBatchIds.add(t.batch_id);
                      }
                    });

                    // 按 batch_id 分组普通任务
                    tasks.forEach((t) => {
                      if (!t.workflow_run_id && !workflowTaskBatchIds.has(t.batch_id)) {
                        if (!batches.has(t.batch_id)) {
                          batches.set(t.batch_id, []);
                        }
                        batches.get(t.batch_id)!.push(t);
                      }
                    });

                    if (batches.size === 0 && viewMode !== 'all') {
                      return (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-xs text-slate-500 sm:rounded-3xl sm:px-6 sm:py-12 sm:text-sm">
                          暂无批量任务
                        </div>
                      );
                    }

                    return Array.from(batches.entries()).map(([batchId, batchTasks]) => {
                      const firstTask = batchTasks[0];
                      return (
                        <BatchTaskCard
                          key={batchId}
                          batchId={batchId}
                          functionType={firstTask.function_type}
                          tasks={batchTasks}
                          createdAt={firstTask.created_at}
                          user_email={firstTask.user_email || ''}
                          user_nickname={firstTask.user_nickname || ''}
                          team_name={firstTask.team_name || ''}
                          showTeam={showTeamColumn}
                          showUser={showUserColumn}
                        />
                      );
                    });
                  })()}
                </>
              )}

              {/* 空状态 */}
              {viewMode === 'all' && workflowRuns.length === 0 && tasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-xs text-slate-500 sm:rounded-3xl sm:px-6 sm:py-12 sm:text-sm">
                  暂无任务记录
                </div>
              )}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-slate-200 bg-white px-3 py-3 shadow-sm sm:rounded-[24px] sm:px-4 sm:py-4">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                上一页
              </button>
              <div className="text-sm text-slate-500">当前第 {page} 页</div>
              <button
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                disabled={page === pagination.totalPages}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                下一页
              </button>
            </div>
          )}
        </div>

        <aside className="space-y-3 sm:space-y-4">
          <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
            <h3 className="text-base font-semibold text-slate-900 sm:text-lg">功能分布</h3>
            <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
              {functionSummary.length === 0 ? (
                <div className="text-sm text-slate-500">暂无汇总数据</div>
              ) : (
                functionSummary.map((item) => (
                  <div key={item.function_type} className="rounded-xl bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-medium text-slate-900">
                        {FUNCTION_NAMES[item.function_type] || item.function_type}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{item.total}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 sm:mt-2">
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
