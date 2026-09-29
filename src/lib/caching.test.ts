import { describe, expect, it } from 'vitest';

import { hasAuthCookie, isPrivateRoute, shouldBypassCache } from './caching';

describe('isPrivateRoute', () => {
  it('matches the account, admin and auth routes and their children', () => {
    for (const path of [
      '/dashboard',
      '/admin',
      '/admin/users',
      '/api/auth/get-session',
      '/api/account/export',
      '/login',
      '/two-factor',
      '/newsletter/confirm',
      '/newsletter/unsubscribe',
      '/_actions/newsletter.subscribe',
    ]) {
      expect(isPrivateRoute(path), path).toBe(true);
    }
  });

  it('leaves public routes alone, including look-alike prefixes', () => {
    for (const path of [
      '/',
      '/blog/hello',
      '/api/repo-stats',
      '/api/health',
      '/newsletter',
      '/loginfo',
      '/administration',
    ]) {
      expect(isPrivateRoute(path), path).toBe(false);
    }
  });
});

describe('hasAuthCookie', () => {
  it('recognises every Better Auth cookie, with or without the secure prefix', () => {
    expect(hasAuthCookie('better-auth.session_token=abc')).toBe(true);
    expect(hasAuthCookie('theme=dark; __Secure-better-auth.session_data=xyz')).toBe(true);
    expect(hasAuthCookie('better-auth.two_factor=pending')).toBe(true);
  });

  it('ignores other cookies and missing headers', () => {
    expect(hasAuthCookie('theme=dark; consent=1')).toBe(false);
    expect(hasAuthCookie('not-better-auth.session_token=abc')).toBe(false);
    expect(hasAuthCookie(null)).toBe(false);
    expect(hasAuthCookie(undefined)).toBe(false);
  });
});

describe('shouldBypassCache', () => {
  const anonymousGet = {
    method: 'GET',
    pathname: '/api/repo-stats',
    cookieHeader: null,
    hasSession: false,
  };

  it('lets anonymous GET and HEAD requests for public routes through', () => {
    expect(shouldBypassCache(anonymousGet)).toBe(false);
    expect(shouldBypassCache({ ...anonymousGet, method: 'HEAD' })).toBe(false);
  });

  it('bypasses writes, signed-in visitors, auth cookies and private routes', () => {
    expect(shouldBypassCache({ ...anonymousGet, method: 'POST' })).toBe(true);
    expect(shouldBypassCache({ ...anonymousGet, hasSession: true })).toBe(true);
    expect(
      shouldBypassCache({ ...anonymousGet, cookieHeader: 'better-auth.session_token=expired' }),
    ).toBe(true);
    expect(shouldBypassCache({ ...anonymousGet, pathname: '/dashboard' })).toBe(true);
  });
});
