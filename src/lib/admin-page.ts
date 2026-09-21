import type { AstroGlobal } from 'astro';

import type { ContactStatus, DeliveryStatus } from '../db/schema/app';

import { isAdmin } from './admin';
import { getAuthoritativeSession } from './session';

/**
 * Authorization for `/admin` pages. It lives in the page rather than the middleware so it
 * cannot be bypassed by unusual URL encodings, and it reads the session through
 * `getAuthoritativeSession()` (src/lib/session.ts). `Astro.locals` is updated with the fresh
 * values for the rest of the render.
 *
 * Returns a response to send instead of the page: a redirect to the login page for
 * anonymous visitors and the 404 page for signed-in users without the admin role, so the
 * existence of the area is not revealed.
 */
export async function guardAdminPage(Astro: AstroGlobal): Promise<Response | null> {
  const { user, session } = await getAuthoritativeSession(Astro.request.headers, Astro.cookies);
  Astro.locals.user = user;
  Astro.locals.session = session;

  if (!user) {
    return Astro.redirect(`/login?next=${encodeURIComponent(Astro.url.pathname)}`);
  }
  if (!isAdmin(user)) {
    // Astro renders the custom 404 page for a 404 response from an on-demand route.
    return new Response(null, { status: 404 });
  }
  return null;
}

/**
 * Confirmation shown after a successful admin action. Actions return a key, the page
 * redirects with `?notice=<key>` (POST → redirect → GET) and the layout renders the text.
 * Only keys listed here are ever rendered, so the query parameter cannot inject content.
 */
export const ADMIN_NOTICES = {
  'message-read': 'Message marked as read.',
  'message-unread': 'Message marked as unread.',
  'message-archived': 'Message archived.',
  'message-deleted': 'Message deleted.',
  'delivery-sent': 'Notification sent.',
  'delivery-failed': 'The notification could not be sent; the error is recorded on the message.',
  'delivery-skipped': 'No recipient is configured (CONTACT_TO_EMAIL), so nothing was sent.',
  'role-updated': 'Role updated.',
  'user-banned': 'User banned and signed out everywhere.',
  'user-unbanned': 'User unbanned.',
  'sessions-revoked': 'The user was signed out everywhere.',
  'user-deleted': 'User deleted.',
} as const;

export type AdminNotice = keyof typeof ADMIN_NOTICES;

function isAdminNotice(value: unknown): value is AdminNotice {
  return typeof value === 'string' && Object.hasOwn(ADMIN_NOTICES, value);
}

/** Text for a `?notice=` value, or null for anything that is not a known key. */
export function noticeMessage(key: string | null | undefined): string | null {
  return isAdminNotice(key) ? ADMIN_NOTICES[key] : null;
}

/** Appends `?notice=` (or `&notice=`) to a redirect target. */
export function withNotice(url: string, notice: AdminNotice | null): string {
  if (!notice) return url;
  return `${url}${url.includes('?') ? '&' : '?'}notice=${encodeURIComponent(notice)}`;
}

/** Collects the outcome of the admin form actions a page renders. */
export interface ActionOutcome {
  /** True when any action completed; the page should redirect (POST → GET). */
  completed: boolean;
  /** First error message, if any action failed. */
  error: string | null;
  /** Notice returned by the completed action, for the redirect. */
  notice: AdminNotice | null;
}

export function summarizeActionResults(
  results: Array<{ data?: unknown; error?: { message: string } | undefined } | undefined>,
): ActionOutcome {
  let completed = false;
  let error: string | null = null;
  let notice: AdminNotice | null = null;
  for (const result of results) {
    if (!result) continue;
    if (result.error) {
      error ??= result.error.message;
      continue;
    }
    completed = true;
    const data: unknown = result.data;
    if (data && typeof data === 'object' && 'notice' in data && isAdminNotice(data.notice)) {
      notice ??= data.notice;
    }
  }
  return { completed, error, notice };
}

/** Display labels for the enum values stored on messages. */
export const MESSAGE_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  read: 'Read',
  archived: 'Archived',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'Skipped',
};
