import { describe, expect, it } from 'vitest';

import { parseAuditFilters, parseDay } from './audit-filters';

describe('parseDay', () => {
  it('accepts a calendar day as UTC midnight', () => {
    expect(parseDay('2026-09-21')?.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('rejects other formats and impossible dates', () => {
    expect(parseDay('21/09/2026')).toBeNull();
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('2026-9-1')).toBeNull();
    expect(parseDay('')).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});

describe('parseAuditFilters', () => {
  it('returns the open filter set for an empty query', () => {
    expect(parseAuditFilters(new URLSearchParams())).toEqual({
      action: null,
      q: '',
      from: null,
      before: null,
      fromInput: '',
      toInput: '',
    });
  });

  it('keeps known actions, trims and bounds the search text', () => {
    const filters = parseAuditFilters(
      new URLSearchParams({ action: 'user.ban', q: `  ${'x'.repeat(120)}  ` }),
    );
    expect(filters.action).toBe('user.ban');
    expect(filters.q).toHaveLength(100);
  });

  it('ignores unknown actions and malformed dates', () => {
    const filters = parseAuditFilters(
      new URLSearchParams({ action: 'user.destroy', from: 'yesterday', to: '2026-13-01' }),
    );
    expect(filters.action).toBeNull();
    expect(filters.from).toBeNull();
    expect(filters.before).toBeNull();
    expect(filters.fromInput).toBe('');
    expect(filters.toInput).toBe('');
  });

  it('makes the end day inclusive by bounding with the following midnight', () => {
    const filters = parseAuditFilters(
      new URLSearchParams({ from: '2026-09-01', to: '2026-09-21' }),
    );
    expect(filters.from?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(filters.before?.toISOString()).toBe('2026-09-22T00:00:00.000Z');
    expect(filters.fromInput).toBe('2026-09-01');
    expect(filters.toInput).toBe('2026-09-21');
  });
});
