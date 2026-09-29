import type { Locale } from '@/i18n';
import { siteConfig } from '@/site.config';

/** A paragraph with inline code: strings render as text, `{ code }` as `<code>`. */
export type RichText = Array<string | { code: string }>;

export interface HomeCopy {
  /** `<title>` tagline and meta description of the page. */
  tagline: string;
  description: string;
  badge: string;
  headline: { before: string; highlight: string; after: string };
  getStarted: string;
  star: string;
  terminal: string;
  targetsHeading: string;
  featuresHeading: string;
  featuresIntro: string;
  features: Array<{ icon: string; title: string; description: string; href: string }>;
  deployHeading: string;
  deployParagraph: RichText;
  platformPoints: string[];
  stackHeading: string;
  stackParagraph: RichText;
  /** `{version}` is the Node range from package.json. */
  nodeBadge: string;
  stackBadges: string[];
  stackCaption: string;
  stackColumns: { package: string; npm: string; installed: string };
  stepsHeading: string;
  steps: Array<{ title: string; description: string }>;
  ctaHeading: string;
  ctaText: string;
  readDocs: string;
  visitBlog: string;
  /** Shown under the call to action when the documentation is not in this language. */
  docsLanguageNote?: string;
}

const featureLinks = {
  intro: '/docs/getting-started/introduction',
  styling: '/docs/guides/styling',
  auth: '/docs/guides/authentication',
  database: '/docs/guides/database',
  content: '/docs/guides/content',
  seo: '/docs/guides/seo',
  security: '/docs/guides/security',
  testing: '/docs/guides/testing',
};

const en: HomeCopy = {
  tagline: siteConfig.tagline,
  description: siteConfig.description,
  badge: 'Astro 7.3 · React 19 · Node 24',
  headline: {
    before: 'Ship a complete website on ',
    highlight: 'Astro 7',
    after: ', not a starter you still have to finish.',
  },
  getStarted: 'Get started',
  star: 'Star on GitHub',
  terminal: 'Terminal',
  targetsHeading: 'One codebase. Four deploy targets.',
  featuresHeading: 'Everything a site needs, already wired together',
  featuresIntro:
    'This site is built from the template you are reading about. Every feature below is running on the page in front of you.',
  features: [
    {
      icon: 'lucide:rocket',
      title: 'Astro 7.3 at the core',
      description:
        'Static-first pages with islands where you need them, Vite 8 and the Rust compiler for fast builds and stricter HTML.',
      href: featureLinks.intro,
    },
    {
      icon: 'lucide:atom',
      title: 'React 19 + Motion',
      description:
        'Interactive islands written in React 19 and animated with Motion, hydrated only where they are used.',
      href: featureLinks.styling,
    },
    {
      icon: 'lucide:palette',
      title: 'Tailwind CSS 4 and dark mode',
      description:
        'OKLCH design tokens, a flash-free theme switch that respects the OS, and self-hosted variable fonts.',
      href: featureLinks.styling,
    },
    {
      icon: 'lucide:shield-check',
      title: 'Better Auth',
      description:
        'Email and password, GitHub, Google and magic-link sign-in with protected routes and sessions stored in your database.',
      href: featureLinks.auth,
    },
    {
      icon: 'lucide:database',
      title: 'Drizzle + libSQL',
      description:
        'A type-safe schema with migrations. A file database in development, Turso over HTTP in production, on every platform.',
      href: featureLinks.database,
    },
    {
      icon: 'lucide:book-open',
      title: 'MDX docs and blog',
      description:
        'Content collections with tabs, callouts, steps, a table of contents, tags, RSS and reading time out of the box.',
      href: featureLinks.content,
    },
    {
      icon: 'lucide:search-check',
      title: 'SEO built in',
      description:
        'Canonical URLs, generated Open Graph images, JSON-LD, sitemap, robots.txt, llms.txt and Pagefind search.',
      href: featureLinks.seo,
    },
    {
      icon: 'lucide:lock',
      title: 'Secure by default',
      description:
        'A hash-based Content Security Policy, hardened response headers, CSRF origin checks and rate limiting.',
      href: featureLinks.security,
    },
    {
      icon: 'lucide:flask-conical',
      title: 'Tested and automated',
      description:
        'Vitest, Playwright with axe accessibility checks, Lighthouse budgets and a CI matrix that builds every target.',
      href: featureLinks.testing,
    },
  ],
  deployHeading: 'Pick a platform at build time',
  deployParagraph: [
    'A single ',
    { code: 'astro.config.ts' },
    ' selects the adapter from the ',
    { code: 'DEPLOY_TARGET' },
    ' environment variable, or detects the platform automatically. Static pages, server-rendered auth routes, image optimisation and security headers work the same way everywhere.',
  ],
  platformPoints: [
    'Static-first output with prerender = false only where you need a server.',
    'One database client that resolves to the right driver on Node, Workers and edge runtimes.',
    'CI builds all four targets on every pull request so nothing drifts.',
  ],
  stackHeading: 'Current, locked and tested',
  stackParagraph: [
    "Versions below are the exact releases installed from this repository's ",
    { code: 'pnpm-lock.yaml' },
    ', read at build time, so the page never lies about what it runs on. Dependabot keeps them fresh and the CI matrix proves every upgrade still builds on all targets.',
  ],
  nodeBadge: 'Node {version}',
  stackBadges: ['pnpm', 'TypeScript strict', 'ESLint 10'],
  stackCaption: 'Core dependencies and their installed versions',
  stackColumns: { package: 'Package', npm: 'npm', installed: 'Installed' },
  stepsHeading: 'From clone to production in three steps',
  steps: [
    {
      title: 'Clone and rename',
      description:
        'Every name, URL and link lives in src/site.config.ts. Update it once and the header, footer, SEO tags and manifest follow.',
    },
    {
      title: 'Write content',
      description:
        'Add MDX to src/content for docs and blog posts. Schemas are validated at build time and the sidebar, TOC and RSS feed update themselves.',
    },
    {
      title: 'Deploy anywhere',
      description:
        'Set DEPLOY_TARGET (or let the platform be detected) and push. Vercel, Cloudflare, Netlify and Node builds share one config.',
    },
  ],
  ctaHeading: 'Start with the docs, or read how it was built',
  ctaText:
    'The documentation covers every part of the template. The blog explains the decisions behind it.',
  readDocs: 'Read the docs',
  visitBlog: 'Visit the blog',
};

export const homeCopy: Record<Locale, HomeCopy> = { en };
