import { defineMiddleware } from 'astro:middleware';

import { securityHeaders } from '../config/security-headers';

/**
 * 1. Populates `Astro.locals.user` / `Astro.locals.session` on server-rendered routes.
 * 2. Applies the shared security headers to every on-demand response.
 *
 * Prerendered pages are built at compile time: they get empty locals and their
 * headers come from the platform (see integrations/security-headers.ts).
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;

  if (context.isPrerendered) {
    return next();
  }

  // The auth handler manages its own requests; skip the extra session lookup.
  const isAuthApi = context.url.pathname.startsWith('/api/auth/');
  if (!isAuthApi) {
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
