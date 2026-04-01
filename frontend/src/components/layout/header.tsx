import { Moon, Sun, LogOut, Search, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/new-job': 'New Simulation',
  '/jobs': 'Simulations',
  '/geometries': 'Geometry Library',
  '/templates': 'Templates',
};

export function Header() {
  const { user, isGuest, logout } = useAuthStore();
  const location = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const displayName = isGuest ? 'Guest' : user?.name || user?.email || 'User';
  const pageTitle = PAGE_TITLES[location.pathname] || 'AutoAnsys';

  return (
    <header className="flex h-14 items-center gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6">
      <h2 className="text-sm font-semibold whitespace-nowrap">{pageTitle}</h2>

      {/* Search */}
      <div className="relative flex-1 max-w-md ml-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          placeholder="Search simulations, geometries..."
          className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-9 pr-3 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] transition-shadow"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setDark(!dark)}
          className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="h-6 w-px bg-[hsl(var(--border))]" />

        <div className="flex items-center gap-2 rounded-lg px-2 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium leading-none">{displayName}</span>
            {isGuest && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none mt-0.5">Guest access</span>
            )}
          </div>
        </div>

        <button
          onClick={logout}
          className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))] transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
