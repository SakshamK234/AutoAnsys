import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Boxes,
  FileBox,
  Flag,
  GitCompareArrows,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Menu,
  Rows3,
  Users,
  X,
} from 'lucide-react';
import { useAuth, isGuest } from '../stores/auth';

const NAV = [
  { to: '/', label: 'Season board', icon: LayoutDashboard, end: true },
  { to: '/runs', label: 'Runs', icon: Rows3 },
  { to: '/meshes', label: 'Meshes', icon: Grid3x3 },
  { to: '/geometries', label: 'Geometries', icon: FileBox },
  { to: '/sweep', label: 'Sweeps', icon: Boxes },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/templates', label: 'Templates', icon: Flag },
  { to: '/groups', label: 'Team', icon: Users },
];

/** The racing-blue rail: the one committed color field of the shell. */
function RailContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <NavLink to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-4 pt-5 pb-6">
        {/* Wordmark: stacked wing-element mark + name */}
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <rect x="3" y="5" width="22" height="4" rx="1" fill="#fff" />
          <rect x="6" y="12" width="19" height="4" rx="1" fill="#fff" opacity="0.75" />
          <rect x="10" y="19" width="15" height="4" rx="1" fill="#fff" opacity="0.5" />
        </svg>
        <span className="font-display text-[17px] font-bold tracking-tight text-white">
          AutoAnsys
        </span>
      </NavLink>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'font-condensed flex items-center gap-3 rounded-[3px] px-3 py-2 text-[13px] font-bold tracking-[0.08em] uppercase transition-colors',
                isActive ? 'bg-white text-race-deep' : 'text-race-text hover:bg-white/10 hover:text-white',
              )
            }
          >
            <Icon size={16} strokeWidth={2.25} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/15 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-white">{user?.name ?? '—'}</p>
            <p className="font-condensed text-[10px] font-bold tracking-[0.14em] text-race-text uppercase">
              {isGuest(user) ? 'Guest · read-only' : (user?.role ?? 'member')}
            </p>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            className="cursor-pointer rounded p-1.5 text-race-text hover:bg-white/10 hover:text-white"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full">
      {/* Desktop rail */}
      <aside className="hidden w-52 shrink-0 bg-race lg:block">
        <RailContent />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between bg-race px-3 lg:hidden">
        <span className="font-display text-[15px] font-bold text-white">AutoAnsys</span>
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer p-2 text-white"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute top-12 bottom-0 left-0 w-60 bg-race">
            <RailContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto pt-12 lg:pt-0">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-tight text-ink">
          {title}
        </h1>
        {sub && <div className="mt-0.5 text-sm text-ink-3">{sub}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
