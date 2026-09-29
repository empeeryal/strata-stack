import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/site.config';

import {
  alternatesFor,
  defaultLocale,
  getLocaleFromPath,
  interpolate,
  intlLocales,
  labelFor,
  localeNames,
  locales,
  localizeHref,
  localizePath,
  ogLocales,
  otherLocales,
  splitLocaleId,
  stripLocale,
  ui,
  useTranslations,
} from './index';

describe('locale configuration', () => {
  it('keeps the default locale in step with site.config.ts', () => {
    expect(defaultLocale).toBe(siteConfig.locale);
    expect(locales).toContain(defaultLocale);
    expect(ogLocales[defaultLocale]).toBe(siteConfig.ogLocale);
  });

  it('describes every locale once', () => {
    for (const table of [localeNames, intlLocales, ogLocales]) {
      expect(Object.keys(table).sort()).toEqual([...locales].sort());
    }
  });

  it('has every string in every locale', () => {
    const reference = Object.keys(ui.en).sort();
    for (const locale of locales) {
      expect(Object.keys(ui[locale]).sort(), locale).toEqual(reference);
      for (const [key, value] of Object.entries(ui[locale])) {
        expect(value.trim(), `${locale}: ${key}`).not.toBe('');
      }
    }
  });
});

describe('paths', () => {
  it('reads the locale from the first segment and ignores prefixes that are not locales', () => {
    expect(getLocaleFromPath('/blog')).toBe('en');
    expect(getLocaleFromPath('/')).toBe('en');
    expect(getLocaleFromPath('/de/blog/hello')).toBe('en');
  });

  it('adds and strips a prefix, which the default locale does not have', () => {
    expect(stripLocale('/blog')).toBe('/blog');
    expect(stripLocale('/de/blog')).toBe('/de/blog');
    expect(localizePath('/blog', 'en')).toBe('/blog');
    expect(localizePath('/', 'en')).toBe('/');
  });

  it('keeps chrome links on the English page', () => {
    expect(localizeHref('/blog', 'en')).toBe('/blog');
    expect(localizeHref('/docs', 'en')).toBe('/docs');
  });

  it('splits locale folders off content ids for configured locales only', () => {
    expect(splitLocaleId('why-astro-7')).toEqual({ locale: 'en', slug: 'why-astro-7' });
    expect(splitLocaleId('de/why-astro-7')).toEqual({ locale: 'en', slug: 'de/why-astro-7' });
    expect(splitLocaleId('guides/styling')).toEqual({ locale: 'en', slug: 'guides/styling' });
  });
});

describe('translations', () => {
  it('keeps the labels from site.config.ts when a locale has no translation', () => {
    expect(labelFor('en', '/docs', 'Docs')).toBe('Docs');
    expect(labelFor('en', '/nowhere', 'Nowhere')).toBe('Nowhere');
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('{year} {author}', { year: 2026, author: 'Ada' })).toBe('2026 Ada');
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });

  it('returns strings for the locale with placeholders applied', () => {
    const t = useTranslations('en');
    expect(t('skip')).toBe('Skip to content');
    expect(t('blog.readingTime', { minutes: 4 })).toBe('4 min read');
    expect(t('footer.copyright', { year: 2026, author: 'Ada' })).toBe(
      '© 2026 Ada. Released under the MIT License.',
    );
  });

  it('lists the English alternate only and no other locale for a switcher', () => {
    expect(alternatesFor('/blog')).toEqual({ en: '/blog' });
    expect(otherLocales('en')).toEqual([]);
  });
});
