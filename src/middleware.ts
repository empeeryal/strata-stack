import { defineMiddleware } from 'astro:middleware';

import { securityHeaders } from '../config/security-headers';

import { shouldBypassCache } from './lib/caching';
import { assertProductionConfig } from './lib/env';

let configVerified = false;

/**
 * Verifies the production configuration once per server instance, populates
 * `Astro.locals.user` / `Astro.locals.session` on server-rendered routes, keeps the route cache
 * off for personal responses and applies the shared security headers to every on-demand
 * response. Prerendered pages are built at
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
  let sessionCookies: string[] = [];
  if (!isAuthApi) {
    // Imported lazily: a static import would set up Better Auth and the database during the build.
    const { auth } = await import('./lib/auth');
    const { headers, response: session } = await auth.api.getSession({
      headers: context.request.headers,
      returnHeaders: true,
    });
    if (session) {
      context.locals.user = session.user;
      context.locals.session = session.session;
    }
    sessionCookies = headers.getSetCookie();
  }

  const response = await next();

  // Route rules and `Astro.cache.set()` may only cache anonymous GET responses of public
  // routes. Decided after the route has run so its own `cache.set()` cannot re-enable it; the
  // cache headers are written once the middleware returns (src/lib/caching.ts).
  if (
    shouldBypassCache({
      method: context.request.method,
      pathname: context.url.pathname,
      cookieHeader: context.request.headers.get('cookie'),
      authorization: context.request.headers.get('authorization'),
      hasSession: context.locals.session !== null,
    })
  ) {
    context.cache.set(false);
    // A route's own `Cache-Control: public` would still let a shared cache in front of the
    // server store the response; a personal response is private to its browser.
    if (!/\b(no-store|private)\b/i.test(response.headers.get('cache-control') ?? '')) {
      response.headers.set('Cache-Control', 'private, no-store');
    }
  }

  // Reading the session may have refreshed the cookie cache or extended the session cookie. The
  // page response has to carry those headers: without them a server-rendered page sends the
  // browser nothing, every later request reads the database again and the cookie expires on its
  // original date however often the session row is extended.
  for (const cookie of sessionCookies) response.headers.append('Set-Cookie', cookie);

  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
