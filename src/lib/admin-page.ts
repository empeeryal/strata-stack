import type { AstroGlobal } from 'astro';

import { isAdmin } from './admin';

/**
 * Authorization for `/admin` pages, kept in the page rather than the middleware so it
 * cannot be bypassed by unusual URL encodings (see docs/guides/authentication).
 *
 * Returns a response to send instead of the page: a redirect to the login page for
 * anonymous visitors and the 404 page for signed-in users without the admin role, so the
 * existence of the area is not revealed.
 */
export async function guardAdminPage(Astro: AstroGlobal): Promise<Response | null> {
  const user = Astro.locals.user;
  if (!user) {
    return Astro.redirect(`/login?next=${encodeURIComponent(Astro.url.pathname)}`);
  }
  if (!isAdmin(user)) {
    // Astro renders the custom 404 page for a 404 response from an on-demand route.
    return new Response(null, { status: 404 });
  }
  return null;
}

/** Collects the outcome of the admin form actions a page renders. */
export interface ActionOutcome {
  /** True when any action completed; the page should redirect (POST → GET). */
  completed: boolean;
  /** First error message, if any action failed. */
  error: string | null;
}

export function summarizeActionResults(
  results: Array<{ data?: unknown; error?: { message: string } | undefined } | undefined>,
): ActionOutcome {
  let completed = false;
  let error: string | null = null;
  for (const result of results) {
    if (!result) continue;
    if (result.error) error ??= result.error.message;
    else completed = true;
  }
  return { completed, error };
}
