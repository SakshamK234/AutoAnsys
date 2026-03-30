import { Moon, Sun, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useState, useEffect } from 'react';

export function Header() {
  const { user, logout } = useAuthStore();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <header className="flex h-16 items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6">
      <h2 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
        FSAE CFD Simulation Platform
      </h2>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setDark(!dark)}
          className="rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <span>{user?.full_name || user?.email || 'User'}</span>
        </div>
        <button
          onClick={logout}
          className="rounded-md p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
