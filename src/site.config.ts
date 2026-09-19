/**
 * Site-wide metadata, navigation and branding; change these values to rebrand.
 *
 * Must stay free of `astro:*` virtual imports: `astro.config.ts` and Node scripts import it.
 */
export const siteConfig = {
  /** Public product name shown in the header, titles and Open Graph cards. */
  name: 'Astro Framework',
  /** Short name used in compact UI such as the web manifest. */
  shortName: 'Framework',
  /** One-line value proposition used on the home page and as the default OG title. */
  tagline: 'An Astro 7 starter with auth, content, search and security built in.',
  /** Default meta description (max ~160 characters). */
  description:
    'An Astro 7 template with React 19, Motion, Tailwind CSS 4, Better Auth, Drizzle + libSQL, MDX docs and blog, SEO, a strict CSP and tests. Deploys to Vercel, Cloudflare, Netlify or Node.',
  /** Canonical production URL. Override at build time with SITE_URL. */
  url: 'https://astro-framework-v2.vercel.app',
  /** BCP 47 language tag used for <html lang> and Open Graph locale. */
  locale: 'en',
  ogLocale: 'en_US',
  /** Default author for blog posts and JSON-LD. */
  author: {
    name: 'empeeryal',
    url: 'https://github.com/empeeryal',
  },
  /** Source repository, used for "Edit this page" links and the footer. */
  repo: {
    url: 'https://github.com/empeeryal/astro-framework-v2',
    branch: 'main',
    /** Path prefix for "Edit this page" links. */
    editPath: 'edit',
  },
  social: {
    github: 'https://github.com/empeeryal/astro-framework-v2',
  },
  /** Primary navigation (desktop header + mobile drawer). */
  nav: [
    { label: 'Docs', href: '/docs' },
    { label: 'Blog', href: '/blog' },
    { label: 'Changelog', href: '/changelog' },
    { label: 'About', href: '/about' },
  ],
  /** Footer link groups. */
  footer: [
    {
      title: 'Product',
      links: [
        { label: 'Documentation', href: '/docs' },
        { label: 'Blog', href: '/blog' },
        { label: 'Changelog', href: '/changelog' },
        { label: 'Search', href: '/search' },
      ],
    },
    {
      title: 'Deploy',
      links: [
        { label: 'Vercel', href: '/docs/deploy/vercel' },
        { label: 'Cloudflare', href: '/docs/deploy/cloudflare' },
        { label: 'Netlify', href: '/docs/deploy/netlify' },
        { label: 'Node & Docker', href: '/docs/deploy/node' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Privacy', href: '/legal/privacy' },
        { label: 'Terms', href: '/legal/terms' },
      ],
    },
  ],
  /** Theme colors reported to the browser UI (address bar, etc.). */
  themeColor: {
    light: '#ffffff',
    dark: '#0b0f19',
  },
  /** Blog settings. */
  blog: {
    postsPerPage: 6,
    title: 'Blog',
    description: 'Engineering notes, release write-ups and guides for building with the template.',
  },
} as const;
