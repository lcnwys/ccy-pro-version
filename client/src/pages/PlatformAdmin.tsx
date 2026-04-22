import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { TaskSummaryCards } from '@/components/TaskSummaryCards';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskListSummary } from '@/types';

interface PlatformApiKey {
  id: number;
  key_value: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  api_key: string | null;
  created_at: string;
}

interface Budget {
  id: number;
  team_id: number;
  amount: number;
  used_amount: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

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

export function PlatformAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<PlatformApiKey[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [activeApiKey, setActiveApiKey] = useState('');
  const [showActiveKey, setShowActiveKey] = useState(false);
  const [rechargeTeamId, setRechargeTeamId] = useState<number>(0);
  const [rechargeAmount, setRechargeAmount] = useState<number>(0);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const budgetMap = useMemo(() => {
    return budgets.reduce<Record<number, Budget>>((acc, item) => {
      acc[item.team_id] = item;
      return acc;
    }, {});
  }, [budgets]);

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTeams(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchBudgets = async () => {
    try {
      const token = localStorage.getItem('token');
      const budgetList: Budget[] = [];

      for (const team of teams) {
        const budgetRes = await fetch(`${API_BASE}/budget/team/${team.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const budgetData = await budgetRes.json();
        if (budgetData.success && budgetData.data) {
          budgetList.push({ ...budgetData.data, team_id: team.id });
        } else {
          budgetList.push({
            id: 0,
            team_id: team.id,
            amount: 0,
            used_amount: 0,
            created_by: 0,
            created_at: '',
            updated_at: '',
          });
        }
      }

      setBudgets(budgetList);
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    }
  };

  const fetchTaskSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/tasks?scope=platform&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTaskSummary(data.data.summary || EMPTY_SUMMARY);
      }
    } catch (error) {
      console.error('Failed to fetch platform task summary:', error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/platform/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApiKeys(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveApiKey = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/platform/api-keys/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setActiveApiKey(data.data.apiKey || '');
      }
    } catch (error) {
      console.error('Failed to fetch active API key:', error);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role !== 'super_admin') {
      return;
    }
    if (user?.role === 'super_admin') {
      void fetchTeams();
      void fetchApiKeys();
      void fetchActiveApiKey();
      void fetchTaskSummary();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (teams.length > 0) {
      void fetchBudgets();
    }
  }, [teams]);

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/budget/recharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: rechargeTeamId,
          amount: rechargeAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRechargeModal(false);
        setRechargeTeamId(0);
        setRechargeAmount(0);
        await fetchBudgets();
        alert('充值成功');
      } else {
        alert(data.error || '充值失败');
      }
    } catch (error) {
      console.error('Failed to recharge:', error);
      alert('充值失败');
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/platform/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          keyValue: newKeyValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewKeyName('');
        setNewKeyValue('');
        await fetchApiKeys();
        await fetchActiveApiKey();
        alert('API Key 创建成功');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
      alert('创建失败');
    }
  };

  const handleToggleApiKey = async (id: number, nextIsActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/platform/api-keys/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        await fetchApiKeys();
        await fetchActiveApiKey();
        alert(nextIsActive ? 'API Key 已激活' : 'API Key 已停用');
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to toggle API key:', error);
      alert('操作失败');
    }
  };

  const handleDeleteApiKey = async (id: number) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/platform/api-keys/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        await fetchApiKeys();
        await fetchActiveApiKey();
        alert('删除成功');
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
      alert('删除失败');
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-sm">
        正在加载平台后台...
      </div>
    );
  }

  if (!loading && user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Platform Console</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">平台管理后台</h1>
            <p className="mt-2 text-sm text-slate-500">这里统一查看平台任务汇总、团队预算和 API Key 运营状态。</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/tasks?scope=platform"
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              打开全平台任务中心
            </Link>
            <button
              onClick={() => setShowRechargeModal(true)}
              className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              充值额度
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              创建 API Key
            </button>
          </div>
        </div>
      </section>

      <TaskSummaryCards summary={taskSummary} />

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">团队预算概览</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">团队</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">总额度</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">已用</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">可用</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teams.map((team) => {
                    const budget = budgetMap[team.id];
                    const available = budget ? budget.amount - budget.used_amount : 0;

                    return (
                      <tr key={team.id}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{team.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{budget?.amount || 0}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{budget?.used_amount || 0}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{available}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => {
                              setRechargeTeamId(team.id);
                              setShowRechargeModal(true);
                            }}
                            className="text-sm font-medium text-cyan-700"
                          >
                            充值
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">当前启用的 API Key</h2>
            {activeApiKey ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="font-mono text-sm text-slate-700">
                  {showActiveKey ? activeApiKey : `${activeApiKey.slice(0, 8)}****`}
                </div>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setShowActiveKey(!showActiveKey)} className="text-sm font-medium text-cyan-700">
                    {showActiveKey ? '隐藏' : '显示'}
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeApiKey);
                      alert('API Key 已复制到剪贴板');
                    }}
                    className="text-sm font-medium text-cyan-700"
                  >
                    复制
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                当前没有启用中的平台 API Key。
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">平台 API Key 列表</h2>
            <div className="mt-4 space-y-3">
              {apiKeys.length === 0 ? (
                <div className="text-sm text-slate-500">暂无 API Key</div>
              ) : (
                apiKeys.map((key) => (
                  <div key={key.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">{key.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {key.key_value.slice(0, 8)}****{key.key_value.slice(-4)}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${key.is_active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                        {key.is_active ? '已激活' : '已停用'}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-3 text-sm">
                      <button onClick={() => handleToggleApiKey(key.id, !key.is_active)} className="font-medium text-cyan-700">
                        {key.is_active ? '停用' : '激活'}
                      </button>
                      <button onClick={() => handleDeleteApiKey(key.id)} className="font-medium text-rose-700">
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">创建平台 API Key</h3>
            <form onSubmit={handleCreateApiKey} className="mt-4 space-y-4">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="例如：生产环境 Key"
                required
              />
              <input
                type="text"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm"
                placeholder="sk-xxxxxxxxxxxxxxxx"
                required
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                  创建
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">给团队充值</h3>
            <form onSubmit={handleRecharge} className="mt-4 space-y-4">
              <select
                value={rechargeTeamId || ''}
                onChange={(e) => setRechargeTeamId(parseInt(e.target.value, 10))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                required
              >
                <option value="">请选择团队</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(parseFloat(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                min="1"
                required
                placeholder="输入充值的次元值"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white">
                  充值
                </button>
                <button type="button" onClick={() => setShowRechargeModal(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
