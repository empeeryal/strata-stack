/**
 * Confirmation shown on the dashboard after one of its form actions. The action returns a
 * key, the page redirects with `?notice=<key>` (POST → redirect → GET) and renders the text.
 * Only keys listed here are ever rendered, so the query parameter cannot inject content.
 */
export const ACCOUNT_NOTICES = {
  'session-revoked': 'That session was signed out.',
  'sessions-revoked': 'Every other session was signed out.',
  'profile-updated': 'Profile updated.',
  'two-factor-enabled': 'Two-factor authentication is on. Keep your backup codes somewhere safe.',
  'two-factor-disabled': 'Two-factor authentication is off.',
  'passkey-added': 'Passkey added. You can sign in with it from the login page.',
  'passkey-removed': 'Passkey removed.',
  'email-updated': 'Email address updated.',
  'email-change':
    'Link confirmed. If the address shown above has not changed yet, a verification link is on its way to the new address; open it to finish.',
} as const;

export type AccountNotice = keyof typeof ACCOUNT_NOTICES;

export function accountNoticeMessage(key: string | null | undefined): string | null {
  return typeof key === 'string' && Object.hasOwn(ACCOUNT_NOTICES, key)
    ? ACCOUNT_NOTICES[key as AccountNotice]
    : null;
}
