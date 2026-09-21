import { describe, expect, it } from 'vitest';

import { formatAddress } from './email';

describe('formatAddress', () => {
  it('quotes the display name', () => {
    expect(formatAddress('Jane Doe', 'jane@example.com')).toBe('"Jane Doe" <jane@example.com>');
  });

  it('drops characters that would break the header', () => {
    expect(formatAddress('Jane "J" <Doe>\r\nBcc: x', 'jane@example.com')).toBe(
      '"Jane J DoeBcc: x" <jane@example.com>',
    );
  });

  it('falls back to the bare address when no name remains', () => {
    expect(formatAddress('  ', 'jane@example.com')).toBe('jane@example.com');
    expect(formatAddress('<>', 'jane@example.com')).toBe('jane@example.com');
  });
});
