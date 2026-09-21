import type { AstroCookies } from 'astro';

import { auth } from './auth';

export type AuthoritativeSession = Pick<App.Locals, 'user' | 'session'>;

/**
 * Resolves the session from the database instead of the signed cookie cache.
 *
 * The middleware populates `locals.user` from the cookie cache (`session.cookieCache`, five
 * minutes), which is fine for showing a name in the header. Wherever access is *decided*
 * (admin pages and actions, the dashboard, the account export, the auth pages' redirect for
 * signed-in visitors) the cache is bypassed so that a demotion, a ban or "sign out
 * everywhere" takes effect on the next request rather than when the cache expires. This
 * costs one database read per privileged request.
 *
 * Pass `Astro.cookies` from a page: when the database has no session for the cookie any
 * more, the stale session and cache cookies are expired in the response, so the header stops
 * showing a signed-in state and the login page cannot bounce back to the dashboard.
 */
export async function getAuthoritativeSession(
  headers: Headers,
  cookies?: AstroCookies,
): Promise<AuthoritativeSession> {
  const { headers: responseHeaders, response } = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
    returnHeaders: true,
  });
  if (!response && cookies) expireCookies(responseHeaders, cookies);
  return { user: response?.user ?? null, session: response?.session ?? null };
}

/** Applies the Set-Cookie headers Better Auth uses to delete an invalid session's cookies. */
function expireCookies(responseHeaders: Headers, cookies: AstroCookies): void {
  for (const header of responseHeaders.getSetCookie()) {
    const name = header.slice(0, header.indexOf('=')).trim();
    if (name) cookies.delete(name, { path: '/' });
  }
}
