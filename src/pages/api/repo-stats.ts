import type { APIRoute } from 'astro';

import { createRepoStatsSource, parseGitHubRepo } from '@/lib/repo-stats';
import { siteConfig } from '@/site.config';

export const prerender = false;

// One reader per server instance: GitHub is asked at most every two minutes, however many
// distinct URLs (query strings) the route cache misses on.
const repo = parseGitHubRepo(siteConfig.repo.url);
const readStats = repo ? createRepoStatsSource(repo) : null;

/**
 * Star and fork counts of the site's repository, shown next to the GitHub link in the header.
 *
 * This is the template's example of a cached server-rendered route (docs/guides/caching).
 * GitHub allows 60 anonymous requests an hour per address, so the rule for this path in
 * `astro.config.ts` (`routeRules`) keeps the answer for an hour at the CDN, or in memory on
 * Node, and serves it stale for a day while a fresh copy is fetched in the background. When
 * GitHub does not answer, the `null` result is kept for a minute only so the next visitor
 * retries soon without hammering a failing upstream. Browsers keep any answer for five minutes.
 */
export const GET: APIRoute = async ({ cache }) => {
  if (!readStats) {
    cache.set(false);
    return Response.json({ error: 'The repository is not hosted on GitHub.' }, { status: 404 });
  }

  const stats = await readStats();
  if (!stats) cache.set({ maxAge: 60 });

  return Response.json(
    { url: siteConfig.repo.url, stars: stats?.stars ?? null, forks: stats?.forks ?? null },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
};
