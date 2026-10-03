import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import sentry from '@sentry/astro';
import pagefind from 'astro-pagefind';
import { defineConfig, envField, fontProviders } from 'astro/config';

import { resolveAdapter, resolveDeployTarget } from './config/adapter';
import { resolveCacheProvider } from './config/cache';
import {
  resolveSentryDsn,
  resolveSentryEnvironment,
  sentryIngestOrigin,
} from './config/monitoring';
import { resolveSiteUrl } from './config/site-url';
import { trustedHosts } from './config/trusted-hosts';
import { securityHeaders } from './integrations/security-headers';
import { themeScript } from './integrations/theme-script';
import { defaultLocale, locales } from './src/i18n/config';
import { siteConfig } from './src/site.config';
import pkg from './package.json' with { type: 'json' };

const deployTarget = resolveDeployTarget();

// Error monitoring (Sentry) exists in a build only when PUBLIC_SENTRY_DSN is set: the browser SDK
// on every page and, on the Node runtimes, the server SDK with a middleware. Cloudflare's workerd
// is not a Node runtime, so there the browser side alone is on (docs/guides/monitoring).
const sentryDsn = resolveSentryDsn(process.env);
const sentryServer = deployTarget !== 'cloudflare';
if (sentryDsn) {
  console.info(
    `[monitoring] Sentry on (browser${sentryServer ? ' and server' : ''}, reports to ${sentryIngestOrigin(sentryDsn)})`,
  );
}

/**
 * Canonical site URL: `SITE_URL`, else the production URL Vercel/Netlify inject, else
 * `siteConfig.url` (config/site-url.ts).
 */
const { url: site, source: siteSource } = resolveSiteUrl(process.env, siteConfig.url);
console.info(`[site] ${site} (from ${siteSource})`);

// On Node behind a reverse proxy, forwarded headers are only trusted for the site's own host
// (config/trusted-hosts.ts); rate limiting would otherwise key on the proxy address.
const hosts = trustedHosts(deployTarget, site);
const allowedDomains = hosts ? { allowedDomains: hosts } : {};

// Kept out of the sitemap. Anchored to the start of the pathname so e.g. /docs/guides/admin
// stays indexable; the trailing group accepts the trailing slash the sitemap integration emits.
const SITEMAP_EXCLUDE = [
  /^\/dashboard(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/api(\/|$)/,
  /^\/login(\/|$)/,
  /^\/signup(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/reset-password(\/|$)/,
  /^\/account-deleted(\/|$)/,
  /^\/500(\/|$)/,
  // noindex pages that only work with a token or a pending sign-in.
  /^\/two-factor(\/|$)/,
  /^\/newsletter\/(confirm|unsubscribe)(\/|$)/,
];

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site,
  output: 'static',
  redirects: {
    '/blog/introducing-astro-framework': '/blog/introducing-strata',
  },
  build: {
    inlineStylesheets: 'auto',
  },

  // English lives at the root, every other locale under its prefix (`/<locale>/...`). There is
  // no fallback: a page exists in a locale only when it was translated. The site ships English
  // only; src/i18n/config.ts and docs/guides/internationalisation describe adding a language.
  i18n: {
    defaultLocale,
    locales: [...locales],
    routing: { prefixDefaultLocale: false },
  },
  adapter: await resolveAdapter(deployTarget),

  // Response cache behind `Astro.cache` and `routeRules`: the platform's CDN on Vercel, Netlify
  // and Cloudflare, the server's memory on Node (config/cache.ts). Only anonymous GET responses
  // of public routes are ever cached; src/middleware.ts turns it off for everything else.
  cache: { provider: await resolveCacheProvider(deployTarget) },
  routeRules: {
    // GitHub allows 60 anonymous API requests an hour; one fetch an hour is plenty for a badge.
    // Kept an hour, then served stale for a day while a fresh copy is fetched in the background.
    '/api/repo-stats': { maxAge: 3600, swr: 86400, tags: ['github'] },
  },

  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((pattern) => pattern.test(new URL(page).pathname)),
      // The integration appends a slash to every URL unless `trailingSlash` is 'never'. The
      // pages' canonical and Open Graph URLs and the breadcrumbs carry none, and a sitemap that
      // lists the other form hands search engines a duplicate of every page.
      serialize: (item) => ({
        ...item,
        url: item.url.replace(/^(https?:\/\/[^/]+\/.+?)\/$/, '$1'),
      }),
    }),
    icon(),
    pagefind(),
    themeScript(),
    securityHeaders({ target: deployTarget }),
    ...(sentryDsn
      ? [
          sentry({
            enabled: { client: true, server: sentryServer },
            // Source maps are uploaded (and then deleted from the build) only when a token for
            // the Sentry project is present; without one the build stays as it is.
            sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
            telemetry: false,
          }),
        ]
      : []),
  ],

  vite: {
    plugins: [tailwindcss()],
    define: {
      __DEPLOY_TARGET__: JSON.stringify(deployTarget),
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Astro's own `use astro:head-inject` directive in MDX modules trips Rolldown's
          // module-level-directive check; it is expected and harmless.
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
            warning.message.includes('astro:head-inject')
          ) {
            return;
          }
          warn(warning);
        },
      },
    },
  },

  // Better Auth stores sessions in the database, so Astro's own session storage is
  // disabled. Re-enable per platform if you need `Astro.session` (see docs/guides/authentication).
  session: false,

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },

  image: {
    responsiveStyles: true,
    layout: 'constrained',
  },

  // Fonts are self-hosted from src/assets/fonts (no third-party requests, offline builds).
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            weight: '100 900',
            style: 'normal',
            src: ['./src/assets/fonts/inter-latin-wght-normal.woff2'],
          },
          {
            weight: '100 900',
            style: 'italic',
            src: ['./src/assets/fonts/inter-latin-wght-italic.woff2'],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          {
            weight: '100 800',
            style: 'normal',
            src: ['./src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2'],
          },
        ],
      },
    },
  ],

  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },

  security: {
    checkOrigin: true,
    ...allowedDomains,
    // Astro emits a Content-Security-Policy with per-page hashes for the scripts and
    // styles it processes. Scripts stay hash-only; only `style-src-attr` is relaxed so
    // that Shiki's inline token colours (style attributes) keep working.
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        // The browser SDK reports to the DSN's origin; nothing else leaves the page.
        `connect-src 'self'${sentryDsn ? ` ${sentryIngestOrigin(sentryDsn)}` : ''}`,
        "media-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // Delivered as a header on Node, Vercel and Netlify. Browsers ignore it in a <meta> policy
        // (Cloudflare), where the X-Frame-Options header from public/_headers takes over.
        "frame-ancestors 'none'",
      ],
      styleDirective: {
        resources: [
          { resource: "'self'", kind: 'element' },
          { resource: "'unsafe-inline'", kind: 'attribute' },
        ],
      },
      scriptDirective: {
        // 'wasm-unsafe-eval' is required by Pagefind's WebAssembly search index.
        resources: ["'self'", "'wasm-unsafe-eval'"],
      },
    },
  },

  // Type-safe public environment variables (import from `astro:env/client`).
  // Server secrets are read via `src/lib/env.ts` because the Better Auth CLI and
  // platform runtimes need plain `process.env` access. See docs/guides/environment-variables.
  env: {
    schema: {
      PUBLIC_ANALYTICS: envField.enum({
        context: 'client',
        access: 'public',
        values: ['none', 'vercel'],
        default: 'none',
      }),
      // Error monitoring (docs/guides/monitoring). The DSN is a public value; setting it turns the
      // Sentry integration on. Environment and release label the reports.
      PUBLIC_SENTRY_DSN: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_SENTRY_ENVIRONMENT: envField.string({
        context: 'client',
        access: 'public',
        default: resolveSentryEnvironment(process.env),
      }),
      PUBLIC_SENTRY_RELEASE: envField.string({
        context: 'client',
        access: 'public',
        default: `${pkg.name}@${pkg.version}`,
      }),
    },
  },
});
