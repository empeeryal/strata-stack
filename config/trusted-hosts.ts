import type { AstroUserConfig } from 'astro';

import type { DeployTarget } from './adapter';

export type AllowedDomains = NonNullable<
  NonNullable<AstroUserConfig['security']>['allowedDomains']
>;

/**
 * Hosts whose forwarded headers the Node server trusts (`security.allowedDomains`).
 *
 * On the Node target requests arrive from a reverse proxy, and Astro only honours
 * `X-Forwarded-For` (the visitor's address that rate limiting keys on) and
 * `X-Forwarded-Proto` when the request's `Host` matches one of these patterns. Without the
 * list every visitor behind the proxy shares the proxy's address, so five contact-form
 * submissions from anyone would throttle the whole site. The site's own hostname is the
 * only host a production proxy should forward for; local runs (`127.0.0.1`, `localhost`)
 * do not match and keep the socket address, which is correct without a proxy.
 *
 * The other targets take the visitor's address from the platform and are unaffected.
 */
export function trustedHosts(target: DeployTarget, site: string): AllowedDomains | undefined {
  if (target !== 'node') return undefined;
  const hostname = new URL(site).hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
  return [{ hostname }];
}
