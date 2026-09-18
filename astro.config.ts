import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import { defineConfig, envField, fontProviders } from 'astro/config';

import { resolveAdapter, resolveDeployTarget } from './config/adapter';
import { securityHeaders } from './integrations/security-headers';
import { themeScript } from './integrations/theme-script';
import { siteConfig } from './src/site.config';

/** Platform we are building for: node | vercel | cloudflare | netlify (see config/adapter.ts). */
const deployTarget = resolveDeployTarget();

/** Canonical site URL. `SITE_URL` wins so preview deployments can override it. */
const site = (process.env.SITE_URL ?? siteConfig.url).replace(/\/+$/, '');

/** Routes that must never appear in the sitemap. */
const SITEMAP_EXCLUDE = [/\/dashboard(\/|$)/, /\/api(\/|$)/, /\/login$/, /\/signup$/, /\/500$/];

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site,
  output: 'static',
  // Default `directory` format + `trailingSlash: 'ignore'` works on every host's static
  // server (Vercel, Netlify, Cloudflare and the Node adapter) without redirect loops.
  build: {
    inlineStylesheets: 'auto',
  },
  adapter: await resolveAdapter(deployTarget),

  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !SITEMAP_EXCLUDE.some((pattern) => pattern.test(new URL(page).pathname)),
    }),
    icon(),
    pagefind(),
    themeScript(),
    securityHeaders({ target: deployTarget }),
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
    // Astro emits a Content-Security-Policy with per-page hashes for the scripts and
    // styles it processes. Scripts stay hash-only; only `style-src-attr` is relaxed so
    // that Shiki's inline token colours (style attributes) keep working.
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "media-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
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
    },
  },
});
