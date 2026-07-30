import { create } from 'zustand';

type ThemeType = 'dark-terminal' | 'neon-cyber' | 'minimal-light';
type DensityType = 'scalper' | 'beginner';

interface ThemeState {
  theme: ThemeType;
  density: DensityType;
  setTheme: (theme: ThemeType) => void;
  setDensity: (density: DensityType) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark-terminal',
  density: 'beginner',

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fxzone_theme', theme);
      
      // Remove all theme classes and apply current
      const root = document.documentElement;
      root.classList.remove('theme-dark-terminal', 'theme-neon-cyber', 'theme-minimal-light', 'dark');
      
      root.classList.add(`theme-${theme}`);
      if (theme !== 'minimal-light') {
        root.classList.add('dark'); // Support standard Tailwind dark utility
      }
    }
    set({ theme });
  },

  setDensity: (density) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fxzone_density', density);
    }
    set({ density });
  },

  initialize: () => {
    if (typeof window === 'undefined') return;
    
    const savedTheme = localStorage.getItem('fxzone_theme') as ThemeType || 'dark-terminal';
    const savedDensity = localStorage.getItem('fxzone_density') as DensityType || 'beginner';
    
    set({ density: savedDensity });
    
    // Apply theme
    const root = document.documentElement;
    root.classList.remove('theme-dark-terminal', 'theme-neon-cyber', 'theme-minimal-light', 'dark');
    root.classList.add(`theme-${savedTheme}`);
    if (savedTheme !== 'minimal-light') {
      root.classList.add('dark');
    }
    
    set({ theme: savedTheme });
  },
}));
