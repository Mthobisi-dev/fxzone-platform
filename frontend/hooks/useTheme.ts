import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function useTheme() {
  const { theme, density, setTheme, setDensity, initialize } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    theme,
    density,
    setTheme,
    setDensity,
    isDark: theme !== 'minimal-light',
  };
}
