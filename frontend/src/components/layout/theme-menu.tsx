import { cn } from '@/lib/utils';
import {
  type ColorScheme,
  COLOR_SCHEMES,
  applyColorScheme,
  applyDarkMode,
  getStoredColorScheme,
  getStoredDarkMode,
} from '@/lib/theme';
import { Check, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(getStoredDarkMode);
  const [scheme, setScheme] = useState<ColorScheme>(getStoredColorScheme);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const selectMode = (isDark: boolean) => {
    setDark(isDark);
    applyDarkMode(isDark);
  };

  const selectScheme = (next: ColorScheme) => {
    setScheme(next);
    applyColorScheme(next);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Appearance"
        className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] py-1 shadow-lg animate-fade-in"
        >
          <p className="px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
            Mode
          </p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!dark}
            onClick={() => selectMode(false)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
              !dark
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            <Sun className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Light</span>
            {!dark && <Check className="h-3 w-3 shrink-0 opacity-70" />}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={dark}
            onClick={() => selectMode(true)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
              dark
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
            )}
          >
            <Moon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Dark</span>
            {dark && <Check className="h-3 w-3 shrink-0 opacity-70" />}
          </button>

          <div className="my-1 border-t border-[hsl(var(--border))]" />

          <p className="px-3 py-1.5 text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
            Accent
          </p>
          <div className="flex items-center gap-1 px-2 pb-2" role="group" aria-label="Accent color">
            {COLOR_SCHEMES.map(({ id, label, preview }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={scheme === id}
                onClick={() => selectScheme(id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors',
                  scheme === id
                    ? 'bg-[hsl(var(--accent))]'
                    : 'hover:bg-[hsl(var(--accent))]',
                )}
              >
                <span
                  className="h-4 w-4 rounded-full ring-1 ring-[hsl(var(--border))]"
                  style={{ backgroundColor: preview }}
                />
                <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
