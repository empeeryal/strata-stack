/**
 * What error reports may carry. Monitoring (Sentry, see docs/guides/monitoring) is opt-in and
 * these rules apply to every event it sends, from the browser and from the server: no account,
 * no address, no cookie or header, and no query string, because the site's links carry sign-in
 * and verification tokens there. The functions are pure and shared by the two SDK init files at
 * the repository root, so one test covers both sides.
 */

/** The parts of a Sentry event these rules touch; the SDK's own type is far wider. */
export interface MonitoredEvent {
  message?: string | undefined;
  level?: string | undefined;
  user?: unknown;
  request?:
    | {
        url?: string | undefined;
        method?: string | undefined;
        query_string?: unknown;
        cookies?: unknown;
        headers?: Record<string, string> | undefined;
        data?: unknown;
      }
    | undefined;
  breadcrumbs?: MonitoredBreadcrumb[] | undefined;
}

export interface MonitoredBreadcrumb {
  category?: string | undefined;
  message?: string | undefined;
  data?: Record<string, unknown> | undefined;
}

/**
 * Headers that say which page or site made the request without identifying anyone. The SDKs are
 * initialised with `httpHeaders: false`, so normally no header reaches this point at all; the
 * list is what survives if that is ever relaxed (the Referer without its query string).
 */
const KEPT_HEADERS = new Set(['user-agent', 'referer', 'host', 'accept-language']);

/** A URL without its query string and fragment; a value that is not a URL comes back as it is. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Console breadcrumbs are dropped (whatever the app or a library logged before the error, which
 * outside production includes the emails with their links); in the others, data values that look
 * like URLs lose their query strings.
 */
export function scrubBreadcrumb<T extends MonitoredBreadcrumb>(breadcrumb: T): T | null {
  if (breadcrumb.category === 'console') return null;
  if (!breadcrumb.data) return breadcrumb;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(breadcrumb.data)) {
    data[key] =
      typeof value === 'string' && /^(https?:)?\//.test(value) ? stripQuery(value) : value;
  }
  return { ...breadcrumb, data };
}

/**
 * Removes everything an event could use to identify a person: the user, cookies, request
 * bodies and headers other than the few that describe the page, plus query strings on the
 * request URL and in breadcrumbs. Returns the same event object kind the SDK passed in.
 */
export function scrubEvent<T extends MonitoredEvent>(event: T): T {
  const scrubbed: MonitoredEvent = { ...event };
  delete scrubbed.user;
  if (event.request) {
    const { cookies: _cookies, data: _data, query_string: _query, ...rest } = event.request;
    const headers = event.request.headers
      ? Object.fromEntries(
          Object.entries(event.request.headers)
            .filter(([name]) => KEPT_HEADERS.has(name.toLowerCase()))
            .map(([name, value]) =>
              name.toLowerCase() === 'referer' ? [name, stripQuery(value)] : [name, value],
            ),
        )
      : undefined;
    scrubbed.request = {
      ...rest,
      ...(event.request.url ? { url: stripQuery(event.request.url) } : {}),
      ...(headers ? { headers } : {}),
    };
  }
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs
      .map((breadcrumb) => scrubBreadcrumb(breadcrumb))
      .filter((breadcrumb) => breadcrumb !== null);
  }
  return scrubbed as T;
}
