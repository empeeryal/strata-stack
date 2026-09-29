import { describe, expect, it } from 'vitest';

import { trustedHosts } from './trusted-hosts';

describe('trustedHosts', () => {
  it('trusts forwarded headers for the site host on the Node target only', () => {
    expect(trustedHosts('node', 'https://example.com')).toEqual([{ hostname: 'example.com' }]);
    expect(trustedHosts('vercel', 'https://example.com')).toBeUndefined();
    expect(trustedHosts('cloudflare', 'https://example.com')).toBeUndefined();
  });

  it('leaves local sites alone, so a direct client cannot spoof its address', () => {
    expect(trustedHosts('node', 'http://localhost:4321')).toBeUndefined();
    expect(trustedHosts('node', 'http://127.0.0.1:4321')).toBeUndefined();
  });
});
