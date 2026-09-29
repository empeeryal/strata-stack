import { type Locale, defaultLocale, isLocale, locales } from './config';
import { type UiKey, labels, localizedRoutes, ui } from './ui';

export * from './config';
export { type UiKey, labels, localizedRoutes, ui } from './ui';

/** `Astro.currentLocale` narrowed to a configured locale; the default when Astro has none. */
export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

/** Locale of a pathname from its first segment; the default locale has no prefix. */
export function getLocaleFromPath(pathname: string): Locale {
  const [first] = pathname.split('/').filter(Boolean);
  return isLocale(first) && first !== defaultLocale ? first : defaultLocale;
}

/** The pathname without its locale prefix: `/de/blog` becomes `/blog`, `/de` becomes `/`. */
export function stripLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const [first] = segments;
  if (isLocale(first) && first !== defaultLocale) segments.shift();
  return `/${segments.join('/')}`;
}

/** Prefixes a locale-free pathname for `locale`: `/blog` becomes `/de/blog`, `/` becomes `/de`. */
export function localizePath(pathname: string, locale: Locale): string {
  const bare = stripLocale(pathname);
  if (locale === defaultLocale) return bare;
  return bare === '/' ? `/${locale}` : `/${locale}${bare}`;
}

/**
 * Where a chrome link should point for `locale`: the translated page when
 * `localizedRoutes` lists one, the English page otherwise.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (locale === defaultLocale) return href;
  return localizedRoutes[locale][href] ?? href;
}

/** Label for a `site.config.ts` navigation or footer entry in `locale`. */
export function labelFor(locale: Locale, key: string, fallback: string): string {
  return labels[locale][key] ?? fallback;
}

/**
 * Locale and slug of a content entry: `de/why-astro-7` is the German translation of
 * `why-astro-7`. Entries without a locale folder belong to the default locale.
 */
export function splitLocaleId(id: string): { locale: Locale; slug: string } {
  const [first, ...rest] = id.split('/');
  if (isLocale(first) && first !== defaultLocale && rest.length > 0) {
    return { locale: first, slug: rest.join('/') };
  }
  return { locale: defaultLocale, slug: id };
}

/** Fills `{name}` placeholders. Unknown placeholders are left in place so they show up in review. */
export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translate = (key: UiKey, vars?: Record<string, string | number>) => string;

/** Translation function for `locale`; falls back to English for a missing string. */
export function useTranslations(locale: Locale): Translate {
  const dictionary = ui[locale];
  return (key, vars) => interpolate(dictionary[key] ?? ui[defaultLocale][key], vars);
}

/**
 * Paths of a chrome-level page in every locale that has it, from `localizedRoutes`: the input
 * for `alternates` on the layout. `/blog` yields `{ en: '/blog', de: '/de/blog' }`.
 */
export function alternatesFor(path: string): Partial<Record<Locale, string>> {
  const alternates: Partial<Record<Locale, string>> = { [defaultLocale]: path };
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const translated = localizedRoutes[locale][path];
    if (translated) alternates[locale] = translated;
  }
  return alternates;
}

/** Locales other than `locale`, in configured order; what the language switcher offers. */
export function otherLocales(locale: Locale): Locale[] {
  return locales.filter((candidate) => candidate !== locale);
}
