'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name = 'User', alt, size = 'md', isOnline, ...props }, ref) => {
    const [hasError, setHasError] = React.useState(false);
    const finalName = alt || name;

    // Compute initials from name
    const initials = finalName
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();

    // Use dicebear avatar generator if no avatar is provided or if there is an error
    const fallbackSrc = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(finalName)}`;
    const avatarSrc = src && !hasError ? src : fallbackSrc;

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-full flex items-center justify-center bg-zinc-800 border border-zinc-700 overflow-visible select-none shrink-0',
          {
            'h-6 w-6 text-[10px]': size === 'xs',
            'h-8 w-8 text-xs': size === 'sm',
            'h-10 w-10 text-sm': size === 'md',
            'h-12 w-12 text-base': size === 'lg',
            'h-16 w-16 text-xl': size === 'xl',
          },
          className
        )}
        {...props}
      >
        {/* User image */}
        <img
          src={avatarSrc}
          alt={name}
          onError={() => setHasError(true)}
          className="h-full w-full object-cover rounded-full"
        />

        {/* Online state badge */}
        {isOnline !== undefined && (
          <span
            className={cn(
              'absolute border-2 border-zinc-950 rounded-full',
              {
                'bg-emerald-500': isOnline,
                'bg-zinc-600': !isOnline,
              },
              {
                'h-2.5 w-2.5 bottom-0 right-0': size === 'xs' || size === 'sm',
                'h-3 w-3 bottom-0 right-0': size === 'md',
                'h-3.5 w-3.5 bottom-0 right-0.5': size === 'lg',
                'h-4 w-4 bottom-0.5 right-0.5': size === 'xl',
              }
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
