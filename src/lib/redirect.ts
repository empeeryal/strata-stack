/**
 * Only allow same-site relative paths for post-login redirects, preventing open redirects
 * such as `?next=https://evil.example` or `?next=//evil.example`. The check runs on the
 * normalised path as well as the raw value: `/..//evil.example` normalises to
 * `//evil.example`, which browsers treat as a protocol-relative URL.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  try {
    const url = new URL(value, 'http://localhost');
    if (url.origin !== 'http://localhost') return fallback;
    // Dot segments and backslashes are resolved by now; a path that starts with two slashes
    // would leave the site when handed to a redirect.
    if (!url.pathname.startsWith('/') || url.pathname.startsWith('//')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
