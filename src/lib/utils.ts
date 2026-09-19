import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class names, resolving conflicts (e.g. `p-2` vs `p-4`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a date for display. Defaults to a medium, locale-aware format. */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
  locale = 'en-US',
): string {
  const value = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, options).format(value);
}

/** ISO 8601 string (UTC) for <time datetime> and structured data. */
export function toISODate(date: Date | string | number): string {
  return (date instanceof Date ? date : new Date(date)).toISOString();
}

/** Remove a trailing slash (except for the root path). */
export function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}
