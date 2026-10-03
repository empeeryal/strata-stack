import { describe, expect, it } from 'vitest';

import { passkeyLabel, toPasskeyItem } from './passkeys';

describe('passkeyLabel', () => {
  it('prefers the given name, then the authenticator maker, then the generic word', () => {
    expect(passkeyLabel({ name: '  Work laptop ', aaguid: null })).toBe('Work laptop');
    expect(passkeyLabel({ name: '', aaguid: 'bada5566-a7aa-401f-bd96-45619a55120d' })).toBe(
      '1Password',
    );
    expect(passkeyLabel({ name: null, aaguid: '00000000-0000-0000-0000-000000000000' })).toBe(
      'Passkey',
    );
    expect(passkeyLabel({})).toBe('Passkey');
  });
});

describe('toPasskeyItem', () => {
  it('keeps only what a page may show and formats the date on the server', () => {
    const createdAt = new Date('2026-10-02T10:00:00Z');
    expect(
      toPasskeyItem({
        id: 'pk1',
        name: ' Phone ',
        aaguid: 'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4',
        backedUp: true,
        createdAt,
      }),
    ).toEqual({
      id: 'pk1',
      name: 'Phone',
      label: 'Phone',
      synced: true,
      createdAt: createdAt.toISOString(),
      createdLabel: expect.stringContaining('2026'),
    });
    expect(toPasskeyItem({ id: 'pk2', backedUp: false, createdAt: null })).toEqual({
      id: 'pk2',
      name: null,
      label: 'Passkey',
      synced: false,
      createdAt: null,
      createdLabel: null,
    });
  });
});
