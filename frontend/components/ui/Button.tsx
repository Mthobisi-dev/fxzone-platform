'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'neon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex min-h-11 items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fx-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fx-bg-canvas)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
          // Variants
          {
            'bg-[var(--fx-accent)] text-white shadow-[0_0_15px_color-mix(in_srgb,var(--fx-accent)_30%,transparent)] hover:brightness-110': variant === 'primary',
            'border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-elevated)] text-[var(--fx-text-strong)] hover:brightness-110': variant === 'secondary',
            'bg-transparent text-[var(--fx-text-muted)] hover:bg-[var(--fx-bg-elevated)] hover:text-[var(--fx-text-strong)]': variant === 'ghost',
            'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]': variant === 'danger',
            'border border-[var(--fx-border-subtle)] bg-transparent text-[var(--fx-text-strong)] hover:bg-[var(--fx-bg-elevated)]': variant === 'outline',
            'bg-purple-600 hover:bg-purple-500 text-white neon-glow-purple shadow-[0_0_15px_rgba(147,51,234,0.4)]': variant === 'neon',
          },
          // Sizes
          {
            'px-3 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
