import { AUDIT_ACTIONS, type AuditAction } from './admin';

/** Filters accepted by the audit log page, parsed from its query string. */
export interface AuditFilters {
  /** Exact action, or null for all. */
  action: AuditAction | null;
  /** Substring of the actor's email or the target id (trimmed, at most 100 characters). */
  q: string;
  /** Inclusive start day (UTC midnight), or null. */
  from: Date | null;
  /** Exclusive end: the UTC midnight after the requested end day, or null. */
  before: Date | null;
  /** The validated `YYYY-MM-DD` values, for the form fields. */
  fromInput: string;
  toInput: string;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` as a UTC day; anything else (including 2026-02-30) is null. */
export function parseDay(value: string | null): Date | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/**
 * Reads the audit log filters from the query string. Unknown actions and malformed dates are
 * ignored rather than reported, so a stale or hand-edited link still shows a sensible page.
 */
export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const rawAction = params.get('action');
  const action = AUDIT_ACTIONS.includes(rawAction as AuditAction)
    ? (rawAction as AuditAction)
    : null;
  const from = parseDay(params.get('from'));
  const to = parseDay(params.get('to'));
  return {
    action,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    from,
    before: to ? new Date(to.valueOf() + 24 * 60 * 60 * 1000) : null,
    fromInput: from ? params.get('from')! : '',
    toInput: to ? params.get('to')! : '',
  };
}
