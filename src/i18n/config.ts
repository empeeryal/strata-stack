/**
 * Locales the site is built in. English is the default and lives at the root (`/blog`); every
 * other locale is prefixed with its code (`/<locale>/blog`). The template ships English only and
 * adding a language starts here (docs/guides/internationalisation). Astro's `i18n` config in
 * astro.config.ts reads these values, so this file must not import anything that needs the Astro
 * runtime.
 */
export const locales = ['en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale = 'en' satisfies Locale;

/** Native names, shown on content written in another locale than the page around it. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
};

/** BCP 47 tags for `Intl` formatting (dates, numbers). */
export const intlLocales: Record<Locale, string> = {
  en: 'en-US',
};

/** Open Graph locale values (`og:locale`). */
export const ogLocales: Record<Locale, string> = {
  en: 'en_US',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
