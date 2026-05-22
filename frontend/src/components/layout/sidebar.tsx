import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  List,
  Box,
  FileText,
  Wind,
  Settings,
  GitCompareArrows,
  Layers,
  Grid3x3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-job', icon: Plus, label: 'New Simulation' },
  { to: '/sweep', icon: Layers, label: 'Parametric Sweep' },
  { to: '/jobs', icon: List, label: 'Jobs' },
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
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-4 w-4 transition-colors', isActive && 'text-[hsl(var(--primary))]')} />
          {label}
          {isActive && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:flex">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-[hsl(var(--border))] px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
          <Wind className="h-4 w-4 text-[hsl(var(--primary-foreground))]" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight leading-none">AutoAnsys</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none mt-0.5">CFD Platform</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Simulation
          </p>
          <div className="space-y-1">
            {mainNav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
            Library
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
          <span>v0.1.0</span>
          <span className="ml-auto rounded bg-[hsl(var(--primary)/0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
            Dev
          </span>
        </div>
      </div>
    </aside>
  );
}
