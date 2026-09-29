import { describe, expect, it } from 'vitest';

import { siteConfig } from '@/site.config';

import {
  alternatesFor,
  defaultLocale,
  getLocaleFromPath,
  interpolate,
  labelFor,
  locales,
  localizeHref,
  localizePath,
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
  it('reads the locale from the first segment', () => {
    expect(getLocaleFromPath('/de/blog/hello')).toBe('de');
    expect(getLocaleFromPath('/de')).toBe('de');
    expect(getLocaleFromPath('/blog')).toBe('en');
    expect(getLocaleFromPath('/')).toBe('en');
    expect(getLocaleFromPath('/design')).toBe('en');
  });

  it('strips and adds the prefix', () => {
    expect(stripLocale('/de/blog')).toBe('/blog');
    expect(stripLocale('/de')).toBe('/');
    expect(stripLocale('/blog')).toBe('/blog');
    expect(localizePath('/blog', 'de')).toBe('/de/blog');
    expect(localizePath('/de/blog', 'de')).toBe('/de/blog');
    expect(localizePath('/', 'de')).toBe('/de');
    expect(localizePath('/de/blog', 'en')).toBe('/blog');
  });

  it('sends chrome links to translated pages only when they exist', () => {
    expect(localizeHref('/blog', 'de')).toBe('/de/blog');
    expect(localizeHref('/docs', 'de')).toBe('/docs');
    expect(localizeHref('/blog', 'en')).toBe('/blog');
  });

  it('splits locale folders off content ids', () => {
    expect(splitLocaleId('de/why-astro-7')).toEqual({ locale: 'de', slug: 'why-astro-7' });
    expect(splitLocaleId('why-astro-7')).toEqual({ locale: 'en', slug: 'why-astro-7' });
    expect(splitLocaleId('de')).toEqual({ locale: 'en', slug: 'de' });
    expect(splitLocaleId('guides/de/thing')).toEqual({ locale: 'en', slug: 'guides/de/thing' });
  });
});

describe('translations', () => {
  it('translates labels from site.config.ts and keeps the English one otherwise', () => {
    expect(labelFor('de', '/docs', 'Docs')).toBe('Dokumentation');
    expect(labelFor('de', '/nowhere', 'Nowhere')).toBe('Nowhere');
    expect(labelFor('en', '/docs', 'Docs')).toBe('Docs');
  });

  it('fills placeholders and leaves unknown ones visible', () => {
    expect(interpolate('{year} {author}', { year: 2026, author: 'Ada' })).toBe('2026 Ada');
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });

  it('returns strings for the locale with placeholders applied', () => {
    const t = useTranslations('de');
    expect(t('skip')).toBe('Zum Inhalt springen');
    expect(t('blog.readingTime', { minutes: 4 })).toBe('4 Min. Lesezeit');
    expect(useTranslations('en')('blog.readingTime', { minutes: 4 })).toBe('4 min read');
  });

  it('collects the alternates of a translated chrome page', () => {
    expect(alternatesFor('/blog')).toEqual({ en: '/blog', de: '/de/blog' });
    expect(alternatesFor('/docs')).toEqual({ en: '/docs' });
  });

  it('lists the other locales for the switcher', () => {
    expect(otherLocales('en')).toEqual(['de']);
    expect(otherLocales('de')).toEqual(['en']);
  });
});
