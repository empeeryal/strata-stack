/**
 * Which responses the route cache may keep.
 *
 * `Astro.cache` and `routeRules` (see docs/guides/caching) mark a response as cacheable for
 * the platform's CDN, or for the server's memory on Node. A cached copy is served to everyone
 * who asks for the same URL, including signed-in visitors, so only anonymous GET responses of
 * public routes may be stored. The middleware calls `shouldBypassCache()` on every
 * server-rendered request and stops the rest from being stored, whatever the rules say. It
 * cannot stop an already stored anonymous copy from being served: cache only routes whose
 * output is the same for everyone.
 */

/** Route prefixes whose responses are always about one person and must never be cached. */
export const PRIVATE_ROUTE_PREFIXES = [
  '/dashboard',
  '/admin',
  '/api/auth',
  '/api/account',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
  '/newsletter/confirm',
  '/newsletter/unsubscribe',
  '/api/health',
  '/_actions',
] as const;

export function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * True when the request carries a Better Auth cookie: a session, the session cookie cache, the
 * remember-me flag or a pending two-factor sign-in. The default cookie prefix is `better-auth`;
 * change the pattern if you set `advanced.cookiePrefix` in `src/lib/auth.ts`.
 */
export function hasAuthCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-|__Host-)?better-auth\./.test(cookieHeader);
}

export interface CacheBypassInput {
  method: string;
  pathname: string;
  cookieHeader: string | null | undefined;
  /** The `Authorization` header, if any; a bearer token makes a response personal too. */
  authorization?: string | null | undefined;
  /** Whether the middleware resolved a session for this request. */
  hasSession: boolean;
}

/**
 * Whether the response cache must stay off for this request. Only anonymous GET (and HEAD)
 * requests for public routes may be cached; a matching route rule does not override this.
 */
export function shouldBypassCache(input: CacheBypassInput): boolean {
  if (input.method !== 'GET' && input.method !== 'HEAD') return true;
  if (input.hasSession || hasAuthCookie(input.cookieHeader)) return true;
  if (input.authorization) return true;
  return isPrivateRoute(input.pathname);
}
