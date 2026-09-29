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
  'language.label': 'Language',
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
  'blog.englishOnly': 'English',
  'blog.readingTime': '{minutes} min read',
  'blog.updated': 'Updated',
  'blog.all': 'All posts',
  'blog.newPosts': 'Get new posts by email',
  'pagination.label': 'Pagination',
  'palette.pages': 'Pages',
  'palette.docs': 'Docs',
  breadcrumb: 'Breadcrumb',
  toc: 'On this page',
} as const;

export type UiKey = keyof typeof en;

const de: Record<UiKey, string> = {
  skip: 'Zum Inhalt springen',
  'header.home': `${siteConfig.name} Startseite`,
  'nav.main': 'Hauptnavigation',
  'nav.search': 'Suche',
  'search.label': 'Website durchsuchen',
  'search.placeholder': 'Suchen…',
  'github.label': 'GitHub-Repository',
  'github.stars': 'GitHub-Repository, {count} Sterne',
  'theme.switch': 'Design wechseln',
  'theme.toDark': 'Zum dunklen Design wechseln',
  'theme.toLight': 'Zum hellen Design wechseln',
  'account.signIn': 'Anmelden',
  'account.admin': 'Admin',
  'menu.open': 'Menü öffnen',
  'menu.close': 'Menü schließen',
  'menu.label': 'Seitennavigation',
  'language.label': 'Sprache',
  'footer.rss': 'RSS-Feed',
  'footer.copyright': '© {year} {author}. Veröffentlicht unter der MIT-Lizenz.',
  'footer.builtWith': 'Erstellt mit',
  'footer.deployedOn': 'und bereitgestellt auf {target}.',
  'newsletter.title': 'Newsletter',
  'newsletter.description':
    'Release-Notes und neue Beiträge per E-Mail, höchstens ein paar Mal im Monat. Jederzeit abbestellbar.',
  'newsletter.email': 'E-Mail-Adresse',
  'newsletter.placeholder': 'du@example.com',
  'newsletter.submit': 'Abonnieren',
  'newsletter.formLabel': 'Newsletter abonnieren',
  'newsletter.sent':
    'Sieh in dein Postfach: Wir haben dir einen Link zur Bestätigung geschickt. Bis du ihn öffnest, wird nichts versendet.',
  'newsletter.invalidEmail': 'Bitte gib eine gültige E-Mail-Adresse ein.',
  'blog.eyebrow': 'Blog',
  'blog.title': 'Blog',
  'blog.description': 'Technische Notizen, Release-Berichte und Anleitungen rund um das Template.',
  'blog.feedTitle': `${siteConfig.name}-Blog`,
  'blog.rss': 'RSS-Feed',
  'blog.tags': 'Schlagwörter',
  'blog.empty': 'Noch keine Beiträge.',
  'blog.newer': 'Neuere',
  'blog.older': 'Ältere',
  'blog.pageTitle': '{title} · Seite {page}',
  'blog.inEnglish': 'Weitere Beiträge auf Englisch',
  'blog.englishOnly': 'Englisch',
  'blog.readingTime': '{minutes} Min. Lesezeit',
  'blog.updated': 'Aktualisiert',
  'blog.all': 'Alle Beiträge',
  'blog.newPosts': 'Neue Beiträge per E-Mail',
  'pagination.label': 'Seitenzahlen',
  'palette.pages': 'Seiten',
  'palette.docs': 'Doku',
  breadcrumb: 'Sie sind hier',
  toc: 'Auf dieser Seite',
};

export const ui: Record<Locale, Record<UiKey, string>> = { en, de };

/**
 * Translations for the navigation and footer entries in `site.config.ts`, keyed by href for
 * links and by the English title for footer groups. Entries without a translation keep their
 * English label, so nothing breaks while a locale is being filled in.
 */
export const labels: Record<Locale, Record<string, string>> = {
  en: {},
  de: {
    '/docs': 'Dokumentation',
    '/blog': 'Blog',
    '/changelog': 'Änderungen',
    '/about': 'Über',
    '/search': 'Suche',
    '/contact': 'Kontakt',
    '/newsletter': 'Newsletter',
    '/legal/privacy': 'Datenschutz',
    '/legal/terms': 'Nutzungsbedingungen',
    '/docs/deploy/vercel': 'Vercel',
    '/docs/deploy/cloudflare': 'Cloudflare',
    '/docs/deploy/netlify': 'Netlify',
    '/docs/deploy/node': 'Node & Docker',
    Product: 'Produkt',
    Deploy: 'Bereitstellung',
    Company: 'Unternehmen',
  },
};

/**
 * English paths that have a translated page, per locale. Links from the chrome go to the
 * translation when there is one and to the English page otherwise; add a row here whenever you
 * translate a page. Blog posts are matched by slug instead (src/lib/content.ts).
 */
export const localizedRoutes: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  de: {
    '/': '/de',
    '/about': '/de/about',
    '/blog': '/de/blog',
    '/rss.xml': '/de/rss.xml',
  },
};
