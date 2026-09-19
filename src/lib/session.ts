import { auth } from './auth';

type Session = typeof auth.$Infer.Session;

export interface AuthoritativeSession {
  user: Session['user'] | null;
  session: Session['session'] | null;
}

/**
 * Resolves the session from the database instead of the signed cookie cache.
 *
 * The middleware populates `locals.user` from the cookie cache (`session.cookieCache`, five
 * minutes), which is fine for showing a name in the header. Wherever access is *decided*
 * (admin pages and actions, account export) the cache is bypassed so that a demotion, a ban
 * or "sign out everywhere" takes effect on the next request rather than when the cache
 * expires. This costs one database read per privileged request.
 */
export async function getAuthoritativeSession(headers: Headers): Promise<AuthoritativeSession> {
  const result = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  return { user: result?.user ?? null, session: result?.session ?? null };
}
