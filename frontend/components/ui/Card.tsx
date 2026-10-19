'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glass-strong' | 'neon';
  glowColor?: 'blue' | 'purple' | 'green' | 'pink';
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, variant = 'glass', glowColor, hoverable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-surface)] text-[var(--fx-text-strong)] transition-all duration-200',
          // Variants
          {
            'bg-[var(--fx-bg-surface)] border-[var(--fx-border-subtle)] text-[var(--fx-text-strong)]': variant === 'default',
            'glass': variant === 'glass',
            'glass-strong': variant === 'glass-strong',
            'theme-neon-cyber:border-purple-500/30 theme-neon-cyber:shadow-[0_0_15px_rgba(168,85,247,0.1)]': variant === 'neon',
          },
          // Glows
          glowColor && {
            'neon-glow-blue border-blue-500/20': glowColor === 'blue',
            'neon-glow-purple border-purple-500/20': glowColor === 'purple',
            'neon-glow-green border-emerald-500/20': glowColor === 'green',
            'neon-glow-pink border-pink-500/20': glowColor === 'pink',
          },
          // Hoverable
          hoverable && 'cursor-pointer hover:scale-[1.01] hover:border-[var(--fx-accent)] hover:bg-[var(--fx-bg-elevated)]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
