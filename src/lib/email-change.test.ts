import { describe, expect, it } from 'vitest';

import { appliesEmailChange, readEmailChangeToken } from './email-change';

function token(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature-not-checked-here`;
}

describe('readEmailChangeToken', () => {
  it('reads the addresses and the step from an email-change token', () => {
    expect(
      readEmailChangeToken(
        token({
          email: 'old@example.com',
          updateTo: 'new@example.com',
          requestType: 'change-email-confirmation',
        }),
      ),
    ).toEqual({
      email: 'old@example.com',
      updateTo: 'new@example.com',
      requestType: 'change-email-confirmation',
    });
    expect(
      readEmailChangeToken(
        token({
          email: 'old@example.com',
          updateTo: 'new@example.com',
          requestType: 'change-email-verification',
        }),
      )?.requestType,
    ).toBe('change-email-verification');
  });

  it('treats an unknown or missing step as the legacy change link', () => {
    const claim = readEmailChangeToken(
      token({ email: 'a@example.com', updateTo: 'b@example.com' }),
    );
    expect(claim?.requestType).toBeNull();
    expect(claim && appliesEmailChange(claim)).toBe(true);
    const confirmation = readEmailChangeToken(
      token({
        email: 'a@example.com',
        updateTo: 'b@example.com',
        requestType: 'change-email-confirmation',
      }),
    );
    expect(confirmation && appliesEmailChange(confirmation)).toBe(false);
  });

  it('returns null for plain verification tokens and anything that is not a token', () => {
    expect(readEmailChangeToken(token({ email: 'a@example.com' }))).toBeNull();
    expect(readEmailChangeToken(token({ email: 'a@example.com', updateTo: '' }))).toBeNull();
    expect(readEmailChangeToken(token({ email: 42, updateTo: 'b@example.com' }))).toBeNull();
    expect(readEmailChangeToken('not.a-jwt')).toBeNull();
    expect(readEmailChangeToken('a.%%%.c')).toBeNull();
    expect(readEmailChangeToken(undefined)).toBeNull();
    expect(readEmailChangeToken(null)).toBeNull();
    expect(readEmailChangeToken(['x'])).toBeNull();
  });
});
