import { applyDarkMode, getStoredDarkMode } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';

/** Session toggle: night race (dark, native) ↔ daylight test (light). */
export function ThemeMenu() {
  const [dark, setDark] = useState(getStoredDarkMode);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyDarkMode(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to daylight session' : 'Switch to night session'}
      title={dark ? 'Daylight test' : 'Night race'}
      className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))] transition-colors"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
