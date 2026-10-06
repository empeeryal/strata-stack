import { describe, expect, it } from 'vitest';

import { scrubBreadcrumb, scrubEvent, stripQuery } from './monitoring';

describe('stripQuery', () => {
  it('removes the query string and fragment and leaves other strings alone', () => {
    expect(stripQuery('https://example.com/api/auth/verify-email?token=abc#x')).toBe(
      'https://example.com/api/auth/verify-email',
    );
    expect(stripQuery('/dashboard?notice=email-change')).toBe('/dashboard');
    expect(stripQuery('/docs')).toBe('/docs');
    expect(stripQuery('not a url')).toBe('not a url');
  });
});

describe('scrubBreadcrumb', () => {
  it('drops query strings from URL-shaped values and keeps the rest', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: { url: '/api/auth/magic-link/verify?token=secret', method: 'GET', status_code: 200 },
      }),
    ).toEqual({
      category: 'fetch',
      data: { url: '/api/auth/magic-link/verify', method: 'GET', status_code: 200 },
    });
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'button' })).toEqual({
      category: 'ui.click',
      message: 'button',
    });
  });

  it('drops console breadcrumbs, whatever they say', () => {
    // Outside production the email module prints the messages it would send, links included.
    expect(
      scrubBreadcrumb({
        category: 'console',
        message: 'Open https://example.com/api/auth/magic-link/verify?token=secret',
        data: { arguments: ['Open https://example.com/api/auth/magic-link/verify?token=secret'] },
      }),
    ).toBeNull();
  });
});

describe('scrubEvent', () => {
  it('removes the user, cookies, body, query string and identifying headers', () => {
    const event = {
      message: 'boom',
      user: { id: 'u1', email: 'ada@example.com', ip_address: '203.0.113.7' },
      request: {
        url: 'https://example.com/reset-password?token=abc',
        method: 'GET',
        query_string: 'token=abc',
        cookies: { 'better-auth.session_token': 'x' },
        data: { password: 'hunter2hunter2' },
        headers: {
          Cookie: 'better-auth.session_token=x',
          Authorization: 'Bearer y',
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://example.com/newsletter/confirm?token=abc',
          'X-Forwarded-For': '203.0.113.7',
        },
      },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/login?next=%2Fadmin', to: '/admin' } },
        { category: 'console', message: 'to: ada@example.com' },
      ],
    };
    const scrubbed = scrubEvent(event);
    expect(scrubbed).toEqual({
      message: 'boom',
      request: {
        url: 'https://example.com/reset-password',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://example.com/newsletter/confirm',
        },
      },
      breadcrumbs: [{ category: 'navigation', data: { from: '/login', to: '/admin' } }],
    });
    // The event the SDK handed over is not changed in place.
    expect(event.user.email).toBe('ada@example.com');
  });

  it('passes events without a request or breadcrumbs through untouched', () => {
    const plain = { message: 'plain', level: 'error' };
    expect(scrubEvent(plain)).toEqual({ message: 'plain', level: 'error' });
    const bare = { request: { method: 'POST' } };
    expect(scrubEvent(bare)).toEqual({ request: { method: 'POST' } });
  });
});
