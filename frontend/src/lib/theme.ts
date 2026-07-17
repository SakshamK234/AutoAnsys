/** Pit Wall theme — one identity, two sessions: night race (dark, native)
 *  and daylight test (light). The old multi-scheme system was retired with
 *  the redesign; `data-theme` attributes are cleared for stale clients. */

export const DARK_MODE_STORAGE_KEY = 'theme';

export function getStoredDarkMode(): boolean {
  return localStorage.getItem(DARK_MODE_STORAGE_KEY) !== 'light';
}

export function applyDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(DARK_MODE_STORAGE_KEY, dark ? 'dark' : 'light');
}

/** Apply persisted theme before React paints (also inlined in index.html). */
export function initTheme(): void {
  delete document.documentElement.dataset.theme; // retire legacy schemes
  localStorage.removeItem('colorScheme');
  applyDarkMode(getStoredDarkMode());
}
