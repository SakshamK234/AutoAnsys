import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  List,
  Box,
  FileText,
  Gauge,
  Settings,
  GitCompareArrows,
  Layers,
  Grid3x3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Pit Wall' },
  { to: '/new-job', icon: Plus, label: 'New Run' },
  { to: '/sweep', icon: Layers, label: 'Sweep' },
  { to: '/jobs', icon: List, label: 'Runs' },
  { to: '/meshes', icon: Grid3x3, label: 'Meshes' },
  { to: '/compare', icon: GitCompareArrows, label: 'Compare' },
];

const libraryNav = [
  { to: '/geometries', icon: Box, label: 'Geometries' },
  { to: '/templates', icon: FileText, label: 'Templates' },
];

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] hover:translate-x-0.5'
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Racing rail on the active item */}
          <span
            className={cn(
              'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-all duration-200',
              isActive
                ? 'bg-gradient-to-b from-[hsl(var(--brand-orange))] to-[hsl(var(--brand-maroon))] opacity-100'
                : 'opacity-0'
            )}
          />
          <Icon className={cn('h-4 w-4 transition-colors', isActive && 'text-[hsl(var(--primary))]')} />
          <span className="font-display uppercase tracking-wide text-[13px]">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 flex-col border-r border-[hsl(var(--border))] carbon-surface lg:flex">
      {/* Marque */}
      <div className="relative flex h-16 items-center gap-3 border-b border-[hsl(var(--border))] px-5">
        <div className="chamfer-sm flex h-9 w-9 items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-orange))] to-[hsl(var(--brand-maroon))]">
          <Gauge className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-bold uppercase tracking-[0.14em] leading-none">
            AutoAnsys
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))] leading-none">
            Pit&nbsp;Wall
          </span>
        </div>
        {/* Racing stripe under the marque */}
        <div className="racing-stripe absolute inset-x-0 bottom-0 h-[2px]" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
            Session
          </p>
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
            Garage
          </p>
          <div className="space-y-1">
            {libraryNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--border))] px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <Settings className="h-3.5 w-3.5" />
          <span className="telemetry text-[11px]">v0.2</span>
          <span className="ml-auto rounded-sm bg-[hsl(var(--primary)/0.15)] px-1.5 py-0.5 font-display text-[9px] font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">
            ARC · fsae
          </span>
        </div>
      </div>
    </aside>
  );
}
