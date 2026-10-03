import * as Sentry from '@sentry/astro';
import {
  PUBLIC_SENTRY_DSN,
  PUBLIC_SENTRY_ENVIRONMENT,
  PUBLIC_SENTRY_RELEASE,
} from 'astro:env/client';

import { scrubBreadcrumb, scrubEvent } from './src/lib/monitoring';

/**
 * Browser-side error monitoring. The Sentry integration bundles this file into every page when
 * `PUBLIC_SENTRY_DSN` is set (astro.config.ts); without the variable it is not part of the build.
 * Errors only: no performance tracing and no session replay, so the SDK stays small and no
 * page content leaves the browser. See docs/guides/monitoring.
 */
Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  environment: PUBLIC_SENTRY_ENVIRONMENT,
  release: PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0,
  // Nothing that identifies a person: no user, cookies, headers, request bodies or query strings.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  beforeSend: (event) => scrubEvent(event),
  beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  // Noise from browser extensions and from browsers aborting their own requests.
  ignoreErrors: [
    /^ResizeObserver loop/,
    /^Non-Error promise rejection captured/,
    /^AbortError/,
    /extension:\/\//,
  ],
});
