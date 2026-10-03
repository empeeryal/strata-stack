import * as Sentry from '@sentry/astro';
import {
  PUBLIC_SENTRY_DSN,
  PUBLIC_SENTRY_ENVIRONMENT,
  PUBLIC_SENTRY_RELEASE,
} from 'astro:env/client';

import { scrubBreadcrumb, scrubEvent } from './src/lib/monitoring';

/**
 * Server-side error monitoring for the Node runtimes (Node, Vercel, Netlify). The Sentry
 * integration loads this file with the server bundle when `PUBLIC_SENTRY_DSN` is set and adds a
 * middleware that reports errors thrown by pages, endpoints and actions. On Cloudflare only the
 * browser side is enabled (astro.config.ts). Same rules as the browser: errors only, no personal
 * data. See docs/guides/monitoring.
 */
Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  environment: PUBLIC_SENTRY_ENVIRONMENT,
  release: PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
});
