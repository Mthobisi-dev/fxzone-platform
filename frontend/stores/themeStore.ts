import { create } from 'zustand';
import { applyThemePreference, normalizeThemePreference, type ThemePreference } from '@/lib/themePreferences';

type ThemeType = ThemePreference;
type DensityType = 'scalper' | 'beginner';

interface ThemeState {
  theme: ThemeType;
  density: DensityType;
  setTheme: (theme: ThemeType) => void;
  setDensity: (density: DensityType) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark-terminal',
  density: 'beginner',

  setTheme: (theme) => {
    const normalizedTheme = normalizeThemePreference(theme);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('fxzone_theme', normalizedTheme); } catch { /* Theme still applies for this page view. */ }
      applyThemePreference(document.documentElement, normalizedTheme);
    }
    set({ theme: normalizedTheme });
  },

  setDensity: (density) => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('fxzone_density', density); } catch { /* Keep the preference for this page view. */ }
    }
    set({ density });
  },

  initialize: () => {
    if (typeof window === 'undefined') return;
    
    let savedTheme: ThemeType = 'dark-terminal';
    let savedDensity: DensityType = 'beginner';
    try {
      savedTheme = normalizeThemePreference(localStorage.getItem('fxzone_theme'));
      const density = localStorage.getItem('fxzone_density');
      if (density === 'scalper' || density === 'beginner') savedDensity = density;
    } catch {
      // Private browsing modes can deny storage access; use safe defaults.
    }
    
    set({ density: savedDensity });
    
    applyThemePreference(document.documentElement, savedTheme);
    
    set({ theme: savedTheme });
  },
}));
