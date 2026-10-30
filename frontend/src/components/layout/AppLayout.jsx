import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  Activity,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  ScrollText,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../lib/permissions.js';
import { ROLE_LABELS } from '../../lib/format.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/submissions', label: 'Submissions', icon: FileText },
  { to: '/hospitals', label: 'Hospitals', icon: Building2, permission: 'manageUsers' },
  { to: '/users', label: 'Users', icon: Users, permission: 'manageUsers' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'viewAuditLogs' },
  { to: '/integration', label: 'Integration', icon: Plug, permission: 'manageIntegration' },
  { to: '/profile', label: 'Profile & Settings', icon: UserCircle },
];

function Sidebar({ onNavigate }) {
  const { user } = useAuth();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Activity className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">HospitalForm AI</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
        {NAV.filter((item) => !item.permission || can(user, item.permission)).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      <p className="px-5 py-4 text-xs text-slate-400">Demo environment · dummy data only</p>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative h-full w-64 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initials}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
