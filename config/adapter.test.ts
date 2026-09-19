import { describe, expect, it } from 'vitest';

import { DEPLOY_TARGETS, isDeployTarget, resolveDeployTarget } from './adapter';

describe('resolveDeployTarget', () => {
  it('prefers an explicit DEPLOY_TARGET', () => {
    expect(resolveDeployTarget({ DEPLOY_TARGET: 'cloudflare', VERCEL: '1' })).toBe('cloudflare');
    expect(resolveDeployTarget({ DEPLOY_TARGET: ' Netlify ' })).toBe('netlify');
  });

  it('detects the platform from its environment variables', () => {
    expect(resolveDeployTarget({ VERCEL: '1' })).toBe('vercel');
    expect(resolveDeployTarget({ NETLIFY: 'true' })).toBe('netlify');
    expect(resolveDeployTarget({ WORKERS_CI: '1' })).toBe('cloudflare');
    expect(resolveDeployTarget({ CF_PAGES: '1' })).toBe('cloudflare');
  });

  it('falls back to node', () => {
    expect(resolveDeployTarget({})).toBe('node');
  });

  it('rejects unknown targets', () => {
    expect(() => resolveDeployTarget({ DEPLOY_TARGET: 'heroku' })).toThrow(/Unknown DEPLOY_TARGET/);
  });

  it('exposes the list of targets', () => {
    expect(DEPLOY_TARGETS).toEqual(['node', 'vercel', 'cloudflare', 'netlify']);
    expect(isDeployTarget('vercel')).toBe(true);
    expect(isDeployTarget('aws')).toBe(false);
  });
});
