import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { to: '/', label: '功能总览', match: (pathname: string) => pathname === '/' || pathname.startsWith('/function/') },
  { to: '/tasks', label: '任务中心', match: (pathname: string) => pathname.startsWith('/tasks') },
  { to: '/workflows', label: 'Workflow', match: (pathname: string) => pathname.startsWith('/workflows') },
  { to: '/teams', label: '团队管理', match: (pathname: string) => pathname.startsWith('/teams') },
];

export function AppShell() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const links = user?.role === 'super_admin'
    ? [...navItems, { to: '/admin', label: '平台后台', match: (pathname: string) => pathname.startsWith('/admin') }]
    : navItems;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.12),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <div className="mx-auto min-h-screen w-full max-w-[1680px] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-xl backdrop-blur sm:rounded-[32px] sm:p-5">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">Chuang Ciyuan</div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-900">创次元 PRO</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                固定框架下切换功能、任务、团队和平台视图，避免页面孤岛。
              </p>
            </div>

            <nav className="mt-8 space-y-2">
              {links.map((item) => {
                const active = item.match(location.pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-lg'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-cyan-300' : 'bg-slate-300'}`} />
                  </Link>
                );
              })}
            </nav>

            <div className="mt-10 rounded-3xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">当前账号</div>
              <div className="mt-3 font-semibold text-slate-900">{user?.nickname || user?.email}</div>
              <div className="mt-1 text-sm text-slate-500">{user?.role === 'super_admin' ? '超级管理员' : user?.is_team_admin ? '团队管理员' : '团队成员'}</div>
              <div className="mt-4 text-sm text-slate-500">
                可用额度：<span className="font-semibold text-slate-900">{user?.balance ?? 0}</span>
              </div>
              <button
                onClick={logout}
                className="mt-4 inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                退出登录
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="lg:hidden">
            <div className="mb-3 rounded-[20px] border border-slate-200 bg-white/90 px-3 py-3 shadow-lg backdrop-blur sm:rounded-[28px] sm:px-4 sm:py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-cyan-700">创次元 PRO</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">{user?.nickname || user?.email}</div>
                </div>
                <button onClick={logout} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                  退出
                </button>
              </div>
              <nav className="mt-3 flex flex-wrap gap-1.5">
                {links.map((item) => {
                  const active = item.match(location.pathname);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`rounded-full px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2 sm:text-sm ${
                        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="min-w-0">
            <div className="mx-auto w-full max-w-[1280px]">
              <Outlet />
            </div>
          </main>
        </div>
        </div>
      </div>
    </div>
  );
}
