'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SentimentType = 'bullish' | 'bearish' | 'neutral' | string;

interface SentimentBadgeProps {
  sentiment: SentimentType;
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

export function SentimentBadge({
  sentiment,
  showIcon = true,
  pulse = false,
  className,
}: SentimentBadgeProps) {
  const normalized = sentiment?.toLowerCase();

  let text = 'Neutral';
  let badgeClasses = 'bg-zinc-800/80 border-zinc-700 text-zinc-300';
  let icon = <Minus size={12} />;

  if (normalized === 'bullish') {
    text = 'Bullish';
    badgeClasses = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    icon = <ArrowUpRight size={12} className={cn(pulse && 'animate-bounce')} />;
  } else if (normalized === 'bearish') {
    text = 'Bearish';
    badgeClasses = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
    icon = <ArrowDownRight size={12} className={cn(pulse && 'animate-bounce')} />;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-sm transition-all',
        badgeClasses,
        pulse && 'shadow-[0_0_8px_rgba(16,185,129,0.15)]',
        className
      )}
    >
      {showIcon && icon}
      <span>{text}</span>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              normalized === 'bullish'
                ? 'bg-emerald-400'
                : normalized === 'bearish'
                ? 'bg-rose-400'
                : 'bg-zinc-400'
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-1.5 w-1.5',
              normalized === 'bullish'
                ? 'bg-emerald-500'
                : normalized === 'bearish'
                ? 'bg-rose-500'
                : 'bg-zinc-500'
            )}
          />
        </span>
      )}
    </span>
  );
}
