import pkg from '../../package.json';

export interface GitHubRepo {
  owner: string;
  name: string;
}

export interface RepoStats {
  stars: number;
  forks: number;
}

/**
 * A rate-limited reader of one repository's stats. Whatever the route cache does (it keys by
 * URL, so `?anything` misses), GitHub is asked at most once per `intervalMs` per server
 * instance; in between, callers get the last answer, including a `null` from a failed call.
 */
export function createRepoStatsSource(
  repo: GitHubRepo,
  options: { intervalMs?: number; fetchImpl?: typeof fetch; now?: () => number } = {},
): () => Promise<RepoStats | null> {
  const intervalMs = options.intervalMs ?? 120_000;
  const now = options.now ?? Date.now;
  let last: { at: number; stats: RepoStats | null } | undefined;
  let inFlight: Promise<RepoStats | null> | undefined;
  return async () => {
    if (last && now() - last.at < intervalMs) return last.stats;
    inFlight ??= fetchRepoStats(repo, options.fetchImpl).then((stats) => {
      last = { at: now(), stats };
      inFlight = undefined;
      return stats;
    });
    return inFlight;
  };
}

/** Owner and name from a github.com repository URL; `null` for anything else. */
export function parseGitHubRepo(url: string): GitHubRepo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') return null;
  const [owner, name] = parsed.pathname.split('/').filter(Boolean);
  if (!owner || !name) return null;
  return { owner, name: name.replace(/\.git$/, '') };
}

/**
 * Star and fork counts from the GitHub REST API. Resolves to `null` when GitHub does not
 * answer usefully (network error, rate limit, unknown repository, unexpected shape) so callers
 * can degrade instead of failing. Anonymous requests are limited to 60 an hour per address,
 * which is why the route that calls this is cached.
 */
export async function fetchRepoStats(
  repo: GitHubRepo,
  fetchImpl: typeof fetch = fetch,
): Promise<RepoStats | null> {
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `${pkg.name}/${pkg.version}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as { stargazers_count?: unknown }).stargazers_count !== 'number' ||
      typeof (data as { forks_count?: unknown }).forks_count !== 'number'
    ) {
      return null;
    }
    const { stargazers_count, forks_count } = data as {
      stargazers_count: number;
      forks_count: number;
    };
    return { stars: stargazers_count, forks: forks_count };
  } catch {
    return null;
  }
}
