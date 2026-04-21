import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Team {
  id: number;
  name: string;
  member_role: string;
}

interface UserBudget {
  amount: number;
  used_amount: number;
  available: number;
}

interface TeamSelectorProps {
  selectedTeamId?: number;
  onTeamChange: (teamId: number | undefined) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export function TeamSelector({ selectedTeamId, onTeamChange }: TeamSelectorProps) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [budget, setBudget] = useState<UserBudget | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    fetchTeamsAndBudget();
  }, [user]);

  const fetchTeamsAndBudget = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');

      // 获取团队列表
      const teamsRes = await fetch(`${API_BASE}/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const teamsData = await teamsRes.json();
      if (teamsData.success) {
        setTeams(teamsData.data);

        // 如果有团队，获取第一个团队的额度
        if (teamsData.data.length > 0) {
          const firstTeamId = teamsData.data[0].id;
          const budgetRes = await fetch(`${API_BASE}/budget/user/${firstTeamId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const budgetData = await budgetRes.json();
          if (budgetData.success) {
            setBudget(budgetData.data);
            if (!selectedTeamId) {
              onTeamChange(firstTeamId);
            }
          }
        } else if (isSuperAdmin) {
          // 超级管理员没有团队时，不选择团队也可以
          setBudget({ amount: 0, used_amount: 0, available: 999999 }); // 显示无限额度
        }
      }
    } catch (error) {
      console.error('Failed to fetch teams and budget:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamChange = async (teamId: number | undefined) => {
    onTeamChange(teamId);

    if (!teamId) {
      // 取消选择团队（超级管理员模式）
      setBudget({ amount: 0, used_amount: 0, available: 999999 });
      return;
    }

    // 获取选中团队的额度
    try {
      const token = localStorage.getItem('token');
      const budgetRes = await fetch(`${API_BASE}/budget/user/${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const budgetData = await budgetRes.json();
      if (budgetData.success) {
        setBudget(budgetData.data);
      }
    } catch (error) {
      console.error('Failed to fetch budget:', error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse flex items-center gap-4">
        <div className="h-10 bg-gray-200 rounded w-48"></div>
        <div className="h-10 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  if (teams.length === 0 && !isSuperAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-sm text-yellow-800">
          您还未加入任何团队，请先创建或加入团队后使用
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!selectedTeamId}
              onChange={(e) => handleTeamChange(e.target.checked ? undefined : (teams[0]?.id || undefined))}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-gray-700">使用平台模式（无限额度，用于功能测试）</span>
          </label>
        </div>
      )}

      {!selectedTeamId && isSuperAdmin ? null : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            选择团队
          </label>
          <select
            value={selectedTeamId || ''}
            onChange={(e) => handleTeamChange(parseInt(e.target.value))}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} {team.member_role === 'admin' ? '(管理员)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {budget && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
          <span className="text-sm font-medium text-indigo-600">
            {isSuperAdmin && !selectedTeamId ? '平台模式：无限额度' : `可用额度：${budget.available} 积分`}
          </span>
        </div>
      )}
    </div>
  );
}
