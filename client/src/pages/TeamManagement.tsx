import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskSummaryCards } from '@/components/TaskSummaryCards';
import type { TaskListSummary } from '@/types';

interface Team {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  api_key: string | null;
  member_role: string;
  created_at: string;
}

interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  user_email: string;
  user_nickname: string;
}

interface UserBudget {
  amount: number;
  used_amount: number;
  available: number;
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

export function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [budgets, setBudgets] = useState<Record<number, UserBudget>>({});
  const [taskSummary, setTaskSummary] = useState<TaskListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateUserId, setAllocateUserId] = useState<number>(0);
  const [allocateAmount, setAllocateAmount] = useState<number>(0);
  const [showCreateMember, setShowCreateMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberNickname, setNewMemberNickname] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  const fetchTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTeams(data.data);
        if (data.data.length > 0 && !selectedTeam) {
          setSelectedTeam(data.data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    }
  };

  const fetchMembers = async (teamId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const fetchBudgets = async () => {
    try {
      const token = localStorage.getItem('token');
      const nextBudgets: Record<number, UserBudget> = {};

      for (const team of teams) {
        const res = await fetch(`${API_BASE}/budget/user/${team.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          nextBudgets[team.id] = data.data;
        }
      }

      setBudgets(nextBudgets);
    } catch (error) {
      console.error('Failed to fetch budgets:', error);
    }
  };

  const fetchApiKey = async (teamId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams/${teamId}/api-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApiKeyMasked(data.data.masked_key || '');
        setApiKey('');
        setShowApiKey(false);
      }
    } catch (error) {
      console.error('Failed to fetch API key:', error);
    }
  };

  const fetchTaskSummary = async (teamId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/tasks?scope=team&teamId=${teamId}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTaskSummary(data.data.summary || EMPTY_SUMMARY);
      }
    } catch (error) {
      console.error('Failed to fetch task summary:', error);
    }
  };

  const handleGetApiKeyFull = async () => {
    if (!selectedTeam) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/api-key/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApiKey(data.data.apiKey || '');
        setShowApiKey(true);
      } else {
        alert(data.error || '获取失败');
      }
    } catch (error) {
      console.error('Failed to fetch full API key:', error);
      alert('获取失败');
    }
  };

  useEffect(() => {
    const load = async () => {
      await fetchTeams();
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    void fetchBudgets();
  }, [teams]);

  useEffect(() => {
    if (!selectedTeam) return;
    void fetchMembers(selectedTeam.id);
    void fetchApiKey(selectedTeam.id);
    void fetchTaskSummary(selectedTeam.id);
  }, [selectedTeam]);

  const handleSaveApiKey = async () => {
    if (!selectedTeam) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/teams/${selectedTeam.id}/api-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (data.success) {
        alert('API Key 保存成功');
        await fetchApiKey(selectedTeam.id);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert('保存失败');
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/auth/create-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newMemberEmail,
          password: newMemberPassword,
          nickname: newMemberNickname,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateMember(false);
        setNewMemberEmail('');
        setNewMemberPassword('');
        setNewMemberNickname('');
        await fetchMembers(selectedTeam.id);
        await fetchTaskSummary(selectedTeam.id);
        alert('成员创建成功');
      } else {
        alert(data.error || '创建失败');
      }
    } catch (error) {
      console.error('Failed to create member:', error);
      alert('创建失败');
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/budget/allocate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          userId: allocateUserId,
          amount: allocateAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAllocateModal(false);
        setAllocateUserId(0);
        setAllocateAmount(0);
        await fetchBudgets();
        await fetchTaskSummary(selectedTeam.id);
        alert('分配成功');
      } else {
        alert(data.error || '分配失败');
      }
    } catch (error) {
      console.error('Failed to allocate:', error);
      alert('分配失败');
    }
  };

  if (loading) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-20 text-center text-sm text-slate-500 shadow-sm">
        正在加载团队管理数据...
      </div>
    );
  }

  const isTeamAdmin = selectedTeam?.member_role === 'admin';

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">Team Console</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">团队管理</h1>
            <p className="mt-2 text-sm text-slate-500">团队管理员在这里看成员、额度、团队 API Key 和团队任务汇总。</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedTeam && (
              <Link
                to={`/tasks?scope=team&teamId=${selectedTeam.id}`}
                className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                打开团队任务中心
              </Link>
            )}
            {isTeamAdmin && (
              <button
                onClick={() => setShowCreateMember(true)}
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                创建成员
              </button>
            )}
          </div>
        </div>
      </section>

      <TaskSummaryCards summary={taskSummary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="lg:col-span-1">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="px-2 py-2 text-lg font-semibold text-slate-900">我的团队</h3>
            <div className="mt-2 space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                    selectedTeam?.id === team.id
                      ? 'border border-cyan-200 bg-cyan-50'
                      : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-semibold text-slate-900">{team.name}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {team.member_role === 'admin' ? '管理员' : '成员'}
                    {budgets[team.id] && ` · 可用 ${budgets[team.id].available}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-2">
          {selectedTeam && (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">{selectedTeam.name}</h2>
                    {selectedTeam.description && (
                      <p className="mt-2 text-sm text-slate-500">{selectedTeam.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                      <span>可用额度：{budgets[selectedTeam.id]?.available || 0}</span>
                      <span>总额度：{budgets[selectedTeam.id]?.amount || 0}</span>
                      <span>已用额度：{budgets[selectedTeam.id]?.used_amount || 0}</span>
                    </div>
                  </div>

                  {isTeamAdmin && (
                    <button
                      onClick={() => setShowAllocateModal(true)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      分配额度
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">团队 API Key</h3>
                <div className="mt-4">
                  {isTeamAdmin ? (
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="请输入团队 API Key"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                      />
                      <button
                        onClick={handleSaveApiKey}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
                        {showApiKey ? apiKey : apiKeyMasked || '未配置'}
                      </span>
                      {apiKeyMasked && (
                        <>
                          <button onClick={() => setShowApiKey(!showApiKey)} className="text-sm font-medium text-cyan-700">
                            {showApiKey ? '隐藏' : '显示'}
                          </button>
                          <button onClick={handleGetApiKeyFull} className="text-sm font-medium text-cyan-700">
                            获取完整
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">团队成员</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">邮箱</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">昵称</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">角色</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">加入时间</th>
                        {isTeamAdmin && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">操作</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map((member) => (
                        <tr key={member.id}>
                          <td className="px-4 py-3 text-sm text-slate-900">{member.user_email}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{member.user_nickname || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{member.role === 'admin' ? '管理员' : '成员'}</td>
                          <td className="px-4 py-3 text-sm text-slate-500">{new Date(member.joined_at).toLocaleDateString('zh-CN')}</td>
                          {isTeamAdmin && member.role !== 'admin' && (
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={async () => {
                                  if (!confirm(`确定要移除成员 ${member.user_email} 吗？`)) return;
                                  try {
                                    const token = localStorage.getItem('token');
                                    await fetch(`${API_BASE}/teams/${selectedTeam.id}/members/${member.user_id}`, {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    await fetchMembers(selectedTeam.id);
                                    await fetchTaskSummary(selectedTeam.id);
                                  } catch (error) {
                                    console.error('Failed to remove member:', error);
                                  }
                                }}
                                className="text-sm font-medium text-rose-700"
                              >
                                移除
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {showCreateMember && isTeamAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">创建成员账号</h3>
            <form onSubmit={handleCreateMember} className="mt-4 space-y-4">
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                required
                placeholder="member@example.com"
              />
              <input
                type="password"
                value={newMemberPassword}
                onChange={(e) => setNewMemberPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                required
                minLength={6}
                placeholder="至少 6 位密码"
              />
              <input
                type="text"
                value={newMemberNickname}
                onChange={(e) => setNewMemberNickname(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="成员昵称"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                  创建
                </button>
                <button type="button" onClick={() => setShowCreateMember(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAllocateModal && isTeamAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">分配额度</h3>
            <form onSubmit={handleAllocate} className="mt-4 space-y-4">
              <select
                value={allocateUserId || ''}
                onChange={(e) => setAllocateUserId(parseInt(e.target.value, 10))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                required
              >
                <option value="">请选择成员</option>
                {members.filter((member) => member.role !== 'admin').map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.user_email} {member.user_nickname ? `(${member.user_nickname})` : ''}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(parseFloat(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                min="1"
                required
                placeholder="输入要分配的次元值"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                  分配
                </button>
                <button type="button" onClick={() => setShowAllocateModal(false)} className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
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
