/**
 * Better Auth's email-change links carry a signed token (a JWT) whose payload names the current
 * address, the new one and which step of the change the link performs. Reading that payload
 * without checking the signature is enough to word an email or to decide whether a link needs
 * a signed-in browser: Better Auth verifies the signature itself before it acts on the token,
 * so nothing here grants anything.
 */
export interface EmailChangeClaim {
  /** The address the account has now. */
  email: string;
  /** The address the account changes to. */
  updateTo: string;
  /**
   * `change-email-confirmation` is the first link, sent to the current address; the other kind
   * (or none, in older tokens) is the link that performs the change.
   */
  requestType: 'change-email-confirmation' | 'change-email-verification' | null;
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** The email-change claim in a verification token, or null for any other token or value. */
export function readEmailChangeToken(token: unknown): EmailChangeClaim | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
    if (typeof payload.email !== 'string' || typeof payload.updateTo !== 'string') return null;
    if (!payload.updateTo) return null;
    const requestType =
      payload.requestType === 'change-email-confirmation' ||
      payload.requestType === 'change-email-verification'
        ? payload.requestType
        : null;
    return { email: payload.email, updateTo: payload.updateTo, requestType };
  } catch {
    return null;
  }
}

/**
 * Whether opening the link changes the account's address (and would give whoever opens it a
 * session). The confirmation step only sends the next link.
 */
export function appliesEmailChange(claim: EmailChangeClaim): boolean {
  return claim.requestType !== 'change-email-confirmation';
}
