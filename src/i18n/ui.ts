import { siteConfig } from '../site.config';

import type { Locale } from './config';

/**
 * Strings of the site chrome and the shared page furniture, per locale. English is the
 * reference: its keys define the set, and TypeScript makes every other locale complete.
 * Placeholders in braces (`{year}`) are filled by `t(key, { year })`.
 *
 * Page copy lives next to the page (`src/i18n/pages/*`) or in the content collections; the
 * account, admin and auth areas are English only (see docs/guides/internationalisation).
 */
const en = {
  skip: 'Skip to content',
  backToTop: 'Back to top',
  'header.home': `${siteConfig.name} home`,
  'nav.main': 'Main',
  'nav.search': 'Search',
  'search.label': 'Search the site',
  'search.placeholder': 'Search…',
  'github.label': 'GitHub repository',
  'github.stars': 'GitHub repository, {count} stars',
  'theme.switch': 'Switch theme',
  'theme.toDark': 'Switch to dark theme',
  'theme.toLight': 'Switch to light theme',
  'account.signIn': 'Sign in',
  'account.admin': 'Admin',
  'menu.open': 'Open menu',
  'menu.close': 'Close menu',
  'menu.label': 'Site navigation',
  'footer.tagline': siteConfig.tagline,
  'footer.rss': 'RSS feed',
  'footer.copyright': '© {year} {author}. Released under the MIT License.',
  'footer.builtWith': 'Built with',
  'footer.deployedOn': 'and deployed on {target}.',
  'newsletter.title': siteConfig.newsletter.title,
  'newsletter.description': siteConfig.newsletter.description,
  'newsletter.email': 'Email address',
  'newsletter.placeholder': 'you@example.com',
  'newsletter.submit': 'Subscribe',
  'newsletter.formLabel': 'Subscribe to the newsletter',
  'newsletter.sent':
    'Check your inbox: we sent you a link to confirm the subscription. Nothing is sent until you open it.',
  'newsletter.invalidEmail': 'Please enter a valid email address.',
  'blog.eyebrow': 'Blog',
  'blog.title': siteConfig.blog.title,
  'blog.description': siteConfig.blog.description,
  'blog.feedTitle': `${siteConfig.name} blog`,
  'blog.rss': 'RSS feed',
  'blog.tags': 'Tags',
  'blog.empty': 'No posts yet.',
  'blog.newer': 'Newer',
  'blog.older': 'Older',
  'blog.pageTitle': '{title} · Page {page}',
  'blog.inEnglish': 'More posts in English',
  'blog.readingTime': '{minutes} min read',
  'blog.updated': 'Updated',
  'blog.all': 'All posts',
  'blog.newPosts': 'Get new posts by email',
  'pagination.label': 'Pagination',
  'pagination.page': 'Page {current} of {total}',
  'prose.anchor': 'Link to this section',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
  'code.copyFailed': 'Copy failed',
  'palette.pages': 'Pages',
  'palette.docs': 'Docs',
  breadcrumb: 'Breadcrumb',
  toc: 'On this page',
} as const;

export type UiKey = keyof typeof en;

export const ui: Record<Locale, Record<UiKey, string>> = { en };

/**
 * Translations for the navigation and footer entries in `site.config.ts`, keyed by href for
 * links and by the English title for footer groups. Entries without a translation keep their
 * English label, so nothing breaks while a locale is being filled in. A locale's entry looks like
 * `de: { '/docs': 'Dokumentation', Product: 'Produkt' }`. Empty while the site has one locale.
 */
export const labels: Record<Locale, Record<string, string>> = {
  en: {},
};

/**
 * English paths that have a translated page, per locale, e.g.
 * `de: { '/': '/de', '/about': '/de/about', '/blog': '/de/blog', '/rss.xml': '/de/rss.xml' }`.
 * Links from the chrome go to the translation when there is one and to the English page
 * otherwise, and the same map feeds the `hreflang` alternates; add a row whenever you translate
 * a page. Blog posts are matched by slug instead (src/lib/content.ts). Empty while the site has
 * one locale.
 */
export const localizedRoutes: Partial<Record<Locale, Record<string, string>>> = {};
