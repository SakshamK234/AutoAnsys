import { LogOut, Search, User } from 'lucide-react';
import { ThemeMenu } from '@/components/layout/theme-menu';
import { useAuthStore } from '@/stores/auth-store';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Pit Wall',
  '/new-job': 'New Run',
  '/sweep': 'Parametric Sweep',
  '/jobs': 'Runs',
  '/meshes': 'Meshes',
  '/compare': 'Compare',
  '/geometries': 'Geometry Garage',
  '/templates': 'Templates',
};

export function Header() {
  const { user, isGuest, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
        navigate(`/jobs?search=${encodeURIComponent(searchQuery.trim())}`);
      }
    },
    [navigate, searchQuery]
  );

  const displayName = isGuest ? 'Guest' : user?.name || user?.email || 'User';
  const pageTitle = PAGE_TITLES[location.pathname] || 'AutoAnsys';

  return (
    <header className="relative flex h-14 items-center gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6">
      <h2 className="speed-lines font-display text-sm font-bold uppercase tracking-[0.18em] whitespace-nowrap">
        {pageTitle}
      </h2>

      {/* Search */}
      <div className="relative flex-1 max-w-md ml-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search runs…"
          className="w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] pl-9 pr-3 py-1.5 text-xs placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] focus:border-[hsl(var(--ring))] transition-shadow"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeMenu />

        <div className="h-6 w-px bg-[hsl(var(--border))]" />

        <div className="flex items-center gap-2 px-2 py-1">
          <div className="chamfer-sm flex h-7 w-7 items-center justify-center bg-gradient-to-br from-[hsl(var(--brand-orange))] to-[hsl(var(--brand-maroon))] text-white">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium leading-none">{displayName}</span>
            {isGuest && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))] leading-none mt-0.5">
                Pit lane only
              </span>
            )}
          </div>
        </div>

        <button
          onClick={logout}
          className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/0.1)] hover:text-[hsl(var(--destructive))] transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
