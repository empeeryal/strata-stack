// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { THEME_SCRIPT, THEME_STORAGE_KEY } from './theme-script';

function run() {
  // The script is an IIFE string; evaluate it against the test DOM.
  new Function(THEME_SCRIPT)();
}

function mockMedia(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: prefersDark }) as unknown as MediaQueryList);
}

describe('theme bootstrap script', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePreference;
  });

  it('applies a stored explicit preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMedia(false);
    run();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('follows the OS when nothing is stored', () => {
    mockMedia(true);
    run();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    mockMedia(false);
    run();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });

  it('is minified enough to inline', () => {
    expect(THEME_SCRIPT.length).toBeLessThan(400);
    expect(THEME_SCRIPT).not.toContain('\n');
  });
});
