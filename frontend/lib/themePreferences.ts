export type ThemePreference = 'dark-terminal' | 'neon-cyber' | 'minimal-light';

const THEMES: readonly ThemePreference[] = ['dark-terminal', 'neon-cyber', 'minimal-light'];

export function normalizeThemePreference(value: unknown): ThemePreference {
  return typeof value === 'string' && THEMES.includes(value as ThemePreference)
    ? value as ThemePreference
    : 'dark-terminal';
}

export function applyThemePreference(root: HTMLElement, value: unknown): ThemePreference {
  const theme = normalizeThemePreference(value);
  root.classList.remove('theme-dark-terminal', 'theme-neon-cyber', 'theme-minimal-light', 'dark');
  root.classList.add(`theme-${theme}`);
  if (theme !== 'minimal-light') root.classList.add('dark');
  root.style.colorScheme = theme === 'minimal-light' ? 'light' : 'dark';
  return theme;
}
