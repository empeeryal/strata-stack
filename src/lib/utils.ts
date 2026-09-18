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

/** URL-friendly slug: lowercase ASCII words separated by single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Remove a trailing slash (except for the root path). */
export function stripTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Build an absolute URL from a site-relative path. */
export function absoluteUrl(path: string, site: string | URL): string {
  return new URL(path, site).toString();
}

/** Clamp a number between two bounds. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
