'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '../ui/Button';
import { Monitor, Compass, Sparkles, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { theme, density, setTheme, setDensity } = useTheme();

  return (
    <div className="flex flex-col gap-4 p-4 glass rounded-xl border border-zinc-800/60 max-w-xs">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Display Theme</h4>
        <div className="flex flex-col gap-2">
          {/* Dark Terminal */}
          <button
            onClick={() => setTheme('dark-terminal')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all duration-200',
              theme === 'dark-terminal'
                ? 'bg-zinc-800/80 border-blue-500/50 text-white shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/50'
            )}
          >
            <Monitor size={14} className="text-blue-400 shrink-0" />
            <div className="flex-1">
              <p>Dark Terminal</p>
              <span className="text-[10px] text-zinc-500">Fintech theme (default)</span>
            </div>
          </button>

          {/* Neon Cyber */}
          <button
            onClick={() => setTheme('neon-cyber')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all duration-200',
              theme === 'neon-cyber'
                ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/50'
            )}
          >
            <Sparkles size={14} className="text-purple-400 shrink-0" />
            <div className="flex-1">
              <p>Neon Cyber</p>
              <span className="text-[10px] text-purple-500/80">Cyberpunk neon accents</span>
            </div>
          </button>

          {/* Minimal Light */}
          <button
            onClick={() => setTheme('minimal-light')}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left border transition-all duration-200',
              theme === 'minimal-light'
                ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
                : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/50'
            )}
          >
            <Compass size={14} className="text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p>Minimal Light</p>
              <span className="text-[10px] text-zinc-500">Bloomberg light mode</span>
            </div>
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Workspace Density</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={density === 'beginner' ? 'primary' : 'outline'}
            onClick={() => setDensity('beginner')}
            className="text-xs py-1 px-2.5 h-8 font-semibold"
          >
            Beginner
          </Button>
          <Button
            size="sm"
            variant={density === 'scalper' ? 'primary' : 'outline'}
            onClick={() => setDensity('scalper')}
            className="text-xs py-1 px-2.5 h-8 font-semibold"
          >
            Scalper
          </Button>
        </div>
      </div>
    </div>
  );
}
