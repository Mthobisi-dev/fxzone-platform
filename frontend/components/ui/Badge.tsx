'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'purple';
  pulse?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, children, variant = 'neutral', pulse = false, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full select-none border',
          {
            // success (green)
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400': variant === 'success',
            // danger (red)
            'bg-red-500/10 border-red-500/20 text-red-400': variant === 'danger',
            // warning (orange/yellow)
            'bg-amber-500/10 border-amber-500/20 text-amber-400': variant === 'warning',
            // info (blue)
            'bg-blue-500/10 border-blue-500/20 text-blue-400': variant === 'info',
            // neutral (grey)
            'bg-zinc-800 border-zinc-700 text-zinc-400': variant === 'neutral',
            // purple (neon)
            'bg-purple-500/10 border-purple-500/20 text-purple-400': variant === 'purple',
          },
          className
        )}
        {...props}
      >
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                {
                  'bg-emerald-400': variant === 'success',
                  'bg-red-400': variant === 'danger',
                  'bg-amber-400': variant === 'warning',
                  'bg-blue-400': variant === 'info',
                  'bg-zinc-400': variant === 'neutral',
                  'bg-purple-400': variant === 'purple',
                }
              )}
            />
            <span
              className={cn('relative inline-flex rounded-full h-1.5 w-1.5', {
                'bg-emerald-500': variant === 'success',
                'bg-red-500': variant === 'danger',
                'bg-amber-500': variant === 'warning',
                'bg-blue-500': variant === 'info',
                'bg-zinc-500': variant === 'neutral',
                'bg-purple-500': variant === 'purple',
              })}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
