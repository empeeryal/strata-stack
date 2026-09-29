import { describe, expect, it, vi } from 'vitest';

import { fetchRepoStats, parseGitHubRepo } from './repo-stats';

describe('parseGitHubRepo', () => {
  it('reads owner and name from repository URLs', () => {
    expect(parseGitHubRepo('https://github.com/empeeryal/strata-stack')).toEqual({
      owner: 'empeeryal',
      name: 'strata-stack',
    });
    expect(parseGitHubRepo('https://www.github.com/empeeryal/strata-stack.git/')).toEqual({
      owner: 'empeeryal',
      name: 'strata-stack',
    });
  });

  it('rejects other hosts, profiles and malformed values', () => {
    expect(parseGitHubRepo('https://gitlab.com/group/project')).toBeNull();
    expect(parseGitHubRepo('https://github.com/empeeryal')).toBeNull();
    expect(parseGitHubRepo('not a url')).toBeNull();
  });
});

describe('fetchRepoStats', () => {
  const repo = { owner: 'empeeryal', name: 'strata-stack' };

  it('returns the counts and identifies itself to the API', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ stargazers_count: 1234, forks_count: 56 }));
    await expect(fetchRepoStats(repo, fetchImpl)).resolves.toEqual({ stars: 1234, forks: 56 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.github.com/repos/empeeryal/strata-stack');
    const headers = new Headers(init?.headers);
    expect(headers.get('Accept')).toBe('application/vnd.github+json');
    expect(headers.get('User-Agent')).toMatch(/^strata-stack\/\d/);
  });

  it('degrades to null on rate limits, network errors and unexpected bodies', async () => {
    const limited = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ message: 'rate limited' }, { status: 403 }));
    await expect(fetchRepoStats(repo, limited)).resolves.toBeNull();

    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchRepoStats(repo, offline)).resolves.toBeNull();

    const odd = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ stargazers_count: 'many' }));
    await expect(fetchRepoStats(repo, odd)).resolves.toBeNull();
  });
});
