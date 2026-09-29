import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
  it('allows same-site relative paths', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/docs?tab=1#intro')).toBe('/docs?tab=1#intro');
  });

  it('rejects absolute and protocol-relative urls', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/');
    expect(safeRedirectPath('//evil.example/path')).toBe('/');
    expect(safeRedirectPath('/\\evil.example')).toBe('/');
    expect(safeRedirectPath('javascript:alert(1)', '/home')).toBe('/home');
  });

  it('rejects paths that only become protocol-relative after normalisation', () => {
    expect(safeRedirectPath('/..//evil.example')).toBe('/');
    expect(safeRedirectPath('/.//evil.example')).toBe('/');
    expect(safeRedirectPath('/a/../../\\evil.example')).toBe('/');
    expect(safeRedirectPath('/docs/../dashboard')).toBe('/dashboard');
  });

  it('falls back when empty', () => {
    expect(safeRedirectPath(null, '/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('', '/dashboard')).toBe('/dashboard');
  });
});
