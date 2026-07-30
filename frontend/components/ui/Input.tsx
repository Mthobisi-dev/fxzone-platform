'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold text-zinc-400 select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3.5 text-zinc-500 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          <input
            id={id}
            ref={ref}
            type={type}
            className={cn(
              'w-full bg-zinc-900/60 border border-zinc-800 focus:border-zinc-700 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200',
              {
                'pl-10': leftIcon,
                'pr-10': rightIcon,
                'border-red-500 focus:border-red-500 focus:ring-red-500/20': error,
              },
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3.5 text-zinc-500 flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <span className="text-xs text-red-500 mt-0.5">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
