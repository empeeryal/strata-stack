import { defineMiddleware } from 'astro:middleware';

import { securityHeaders } from '../config/security-headers';

import { assertProductionConfig } from './lib/env';

let configVerified = false;

/**
 * Verifies the production configuration once per server instance, populates
 * `Astro.locals.user` / `Astro.locals.session` on server-rendered routes and applies the
 * shared security headers to every on-demand response. Prerendered pages are built at
 * compile time: they get empty locals and their headers come from the platform (see
 * integrations/security-headers.ts).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  if (context.isPrerendered) {
    return next();
  }

  if (!configVerified) {
    assertProductionConfig();
    configVerified = true;
  }

  // The auth handler manages its own requests; skip the extra session lookup.
  const isAuthApi = context.url.pathname.startsWith('/api/auth/');
  if (!isAuthApi) {
    // Imported lazily: a static import would set up Better Auth and the database during the build.
    const { auth } = await import('./lib/auth');
    const result = await auth.api.getSession({ headers: context.request.headers });
    if (result) {
      context.locals.user = result.user;
      context.locals.session = result.session;
    }
  }

  const response = await next();
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
