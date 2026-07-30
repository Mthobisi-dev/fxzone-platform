import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Base Theme variables map to CSS variables in globals.css
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        card: 'var(--color-card)',
        border: 'var(--color-border)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        
        // Brand/Utility colors
        primary: {
          DEFAULT: '#3b82f6', // Electric blue
          dark: '#1d4ed8',
          light: '#60a5fa',
        },
        accent: {
          DEFAULT: '#10b981', // Emerald green
          dark: '#047857',
          light: '#34d399',
        },
        danger: {
          DEFAULT: '#ef4444',
          dark: '#b91c1c',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        
        // Custom Zinc shades used throughout components
        zinc: {
          350: '#b0b0bb',
          550: '#646473',
          750: '#33333d',
          850: '#1e1e24',
        },
        
        // Neon palette for Neon Cyber theme
        neon: {
          blue: '#00d2ff',
          purple: '#d800ff',
          green: '#00ff66',
          pink: '#ff007f',
          orange: '#ffaa00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ticker-scroll': 'ticker 30s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 2s infinite alternate',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%': { boxShadow: '0 0 4px rgba(59, 130, 246, 0.2), 0 0 12px rgba(59, 130, 246, 0.2)' },
          '100%': { boxShadow: '0 0 12px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.4)' },
        }
      },
      boxShadow: {
        'glass-sm': '0 2px 8px 0 rgba(0, 0, 0, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-strong': '0 8px 32px 0 rgba(0, 0, 0, 0.6)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};

export default config;
