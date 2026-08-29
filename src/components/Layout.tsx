import { NavLink } from 'react-router-dom';
import { useApp } from '../store/AppState';
import { useAuth } from '../store/AuthState';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'Daily',
    items: [
      { to: '/', label: 'Home', icon: '◎', end: true },
      { to: '/today', label: 'Today', icon: '☑' },
      { to: '/inbox', label: 'Inbox', icon: '📥' },
    ],
  },
  {
    group: 'Learn',
    items: [
      { to: '/learn', label: 'Learn', icon: '📚' },
      { to: '/knowledge', label: 'Knowledge', icon: '🧠' },
      { to: '/projects', label: 'Projects', icon: '🛠' },
    ],
  },
  {
    group: 'Markets',
    items: [
      { to: '/markets', label: 'Markets', icon: '📈' },
      { to: '/insights', label: 'Insights', icon: '💡' },
    ],
  },
  {
    group: 'Track',
    items: [
      { to: '/career', label: 'Career', icon: '💼' },
      { to: '/reviews', label: 'Reviews', icon: '🔁' },
      { to: '/roadmap', label: 'Roadmap', icon: '🗺' },
    ],
  },
  {
    group: 'System',
    items: [
      { to: '/resources', label: 'Resources', icon: '🔗' },
      { to: '/research', label: 'Deep dives', icon: '🔬' },
      { to: '/settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

const SYNC_LABEL: Record<string, string> = {
  idle: '○ Local only',
  offline: '○ Local only',
  syncing: '⟳ Syncing…',
  synced: '● Synced',
  error: '⚠ Sync error',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { state, patch, syncEnabled, syncStatus } = useApp();
  const { session } = useAuth();
  const dark = state.theme === 'dark';
  const inboxCount = (state.feed ?? []).filter((f) => f.status === 'inbox').length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-4 px-2 pt-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">Q</span>
            <div>
              <div className="text-sm font-bold leading-tight">Quant-OS</div>
              <div className="text-[10px] text-slate-400">personal dev operating system</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</div>
              <div className="space-y-0.5">
                {g.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <span className="w-4 text-center text-xs">{n.icon}</span>
                    <span className="flex-1">{n.label}</span>
                    {n.to === '/inbox' && inboxCount > 0 && (
                      <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{inboxCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        {syncEnabled && (
          <div className="mb-1 truncate px-2 text-[10px] text-slate-400" title={session?.user.email ?? undefined}>
            {SYNC_LABEL[syncStatus]}
            {session?.user.email ? ` · ${session.user.email}` : ''}
          </div>
        )}
        <button
          onClick={() => patch({ theme: dark ? 'light' : 'dark' })}
          className="btn-ghost mt-3 w-full justify-center"
        >
          {dark ? '☀ Light mode' : '☾ Dark mode'}
        </button>
      </aside>

      {/* Mobile top nav */}
      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
          {NAV.flatMap((g) => g.items).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
              {n.label}
            </NavLink>
          ))}
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
