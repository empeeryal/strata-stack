/**
 * Confirmation shown on the dashboard after one of its form actions. The action returns a
 * key, the page redirects with `?notice=<key>` (POST → redirect → GET) and renders the text.
 * Only keys listed here are ever rendered, so the query parameter cannot inject content.
 */
export const ACCOUNT_NOTICES = {
  'session-revoked': 'That session was signed out.',
  'sessions-revoked': 'Every other session was signed out.',
} as const;

export type AccountNotice = keyof typeof ACCOUNT_NOTICES;

export function accountNoticeMessage(key: string | null | undefined): string | null {
  return typeof key === 'string' && Object.hasOwn(ACCOUNT_NOTICES, key)
    ? ACCOUNT_NOTICES[key as AccountNotice]
    : null;
}
