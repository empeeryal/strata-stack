import type { DeployTarget } from '../../config/adapter';

const LABELS: Record<DeployTarget, string> = {
  node: 'Node',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare',
  netlify: 'Netlify',
};

/** Display name of the platform this build targets (`__DEPLOY_TARGET__` from astro.config.ts). */
export const deployTargetLabel = LABELS[__DEPLOY_TARGET__];
