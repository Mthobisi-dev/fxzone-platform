import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Class name merger utility (clsx-based).
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format numerical pricing based on currency asset types.
 */
export function formatPrice(price: number, symbol: string = ''): string {
  const symbolUpper = symbol.toUpperCase();
  let decimals = 2;
  
  if (symbolUpper.includes('JPY')) decimals = 2;
  else if (symbolUpper.includes('USD') && (symbolUpper.includes('BTC') || symbolUpper.includes('ETH'))) decimals = 2;
  else if (symbolUpper.includes('USD')) decimals = 4;
  else if (price < 1) decimals = 5;

  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (symbolUpper.includes('USD') || symbolUpper.includes('XAU')) {
    return `$${formatted}`;
  } else if (symbolUpper.includes('JPY')) {
    return `¥${formatted}`;
  } else if (symbolUpper.includes('GBP')) {
    return `£${formatted}`;
  } else if (symbolUpper.includes('EUR')) {
    return `€${formatted}`;
  }
  
  return formatted;
}

/**
 * Format percentage metrics (e.g. +2.34% or -0.12%).
 */
export function formatPercentage(percentage: number): string {
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

/**
 * Standard date formatter.
 */
export function formatDate(date: string | Date | number, formatStr: string = 'PPpp'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return format(d, formatStr);
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Relative distance formatter (e.g. "3 hours ago").
 */
export function timeAgo(date: string | Date | number): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'some time ago';
  }
}

/**
 * Generates initials or loads a dicebear fallback avatar.
 */
export function generateAvatar(username: string = 'User'): string {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
}
