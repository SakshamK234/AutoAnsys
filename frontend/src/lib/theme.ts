export type ColorScheme = 'default' | 'blue' | 'green';

export const COLOR_SCHEME_STORAGE_KEY = 'colorScheme';
export const DARK_MODE_STORAGE_KEY = 'theme';

export const COLOR_SCHEMES: {
  id: ColorScheme;
  label: string;
  /** Static preview swatch (HSL) — independent of active theme */
  preview: string;
}[] = [
  { id: 'default', label: 'Orange', preview: 'hsl(25 95% 53%)' },
  { id: 'blue', label: 'Blue', preview: 'hsl(217 91% 55%)' },
  { id: 'green', label: 'Green', preview: 'hsl(142 76% 40%)' },
];

export function isColorScheme(value: string | null): value is ColorScheme {
  return value === 'default' || value === 'blue' || value === 'green';
}

export function getStoredColorScheme(): ColorScheme {
  const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
  return isColorScheme(stored) ? stored : 'default';
}

export function getStoredDarkMode(): boolean {
  return localStorage.getItem(DARK_MODE_STORAGE_KEY) !== 'light';
}

export function applyColorScheme(scheme: ColorScheme): void {
  if (scheme === 'default') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = scheme;
  }
  localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
}

export function applyDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(DARK_MODE_STORAGE_KEY, dark ? 'dark' : 'light');
}

/** Apply persisted theme before React paints (also called from index.html inline script). */
export function initTheme(): void {
  applyColorScheme(getStoredColorScheme());
  applyDarkMode(getStoredDarkMode());
}
