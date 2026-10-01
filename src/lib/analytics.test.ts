import { beforeEach, describe, expect, it, vi } from 'vitest';

const track = vi.fn();
// The client is wrapped in a plain function: Vitest reports an error thrown by a mock
// implementation as a failure even when the code under test catches it, and the point of the
// last test is that `trackEvent()` does catch it.
let clientBroken = false;
vi.mock('@vercel/analytics', () => ({
  track: (...args: unknown[]) => {
    if (clientBroken) throw new Error('not in a browser');
    return track(...args);
  },
}));

async function load(setting: string) {
  vi.resetModules();
  vi.doMock('astro:env/client', () => ({ PUBLIC_ANALYTICS: setting }));
  return import('./analytics');
}

describe('trackEvent', () => {
  beforeEach(() => {
    track.mockReset();
    clientBroken = false;
  });

  it('forwards events and their properties when Vercel analytics is on', async () => {
    const { analyticsEnabled, trackEvent } = await load('vercel');
    expect(analyticsEnabled).toBe(true);
    trackEvent('Newsletter subscribed', { source: 'footer' });
    trackEvent('Signed out');
    expect(track).toHaveBeenCalledWith('Newsletter subscribed', { source: 'footer' });
    expect(track).toHaveBeenCalledWith('Signed out', undefined);
  });

  it('sends nothing when analytics is off', async () => {
    const { analyticsEnabled, trackEvent } = await load('none');
    expect(analyticsEnabled).toBe(false);
    trackEvent('Theme changed', { theme: 'dark' });
    expect(track).not.toHaveBeenCalled();
  });

  it('never lets the analytics client break the page', async () => {
    const { trackEvent } = await load('vercel');
    clientBroken = true;
    expect(() => trackEvent('Code copied')).not.toThrow();
    expect(track).not.toHaveBeenCalled();
  });
});
