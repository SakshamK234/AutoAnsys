import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  List,
  Box,
  FileText,
  Settings,
  Wind,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-job', icon: Plus, label: 'New Simulation' },
  { to: '/jobs', icon: List, label: 'Jobs' },
  { to: '/geometries', icon: Box, label: 'Geometries' },
  { to: '/templates', icon: FileText, label: 'Templates' },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:block">
      <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--border))] px-6">
        <Wind className="h-6 w-6 text-[hsl(var(--primary))]" />
        <span className="text-lg font-bold">AutoAnsys</span>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
