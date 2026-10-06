import type { track } from '@vercel/analytics';

/**
 * Custom events for Vercel Web Analytics, one catalogue for the whole site so the dashboard
 * never fills with near-duplicates. Each entry names the event and the properties it carries;
 * properties are never personal data (no addresses, names or ids), only the kind of thing that
 * happened. Events are sent only when `PUBLIC_ANALYTICS=vercel`, the same switch that renders
 * the analytics script; elsewhere `trackEvent()` is a no-op, so islands and scripts can call it
 * unconditionally. Custom events need a Vercel Pro or Enterprise plan to show up in the
 * dashboard; on Hobby the calls are accepted and ignored.
 */
export interface AnalyticsEvents {
  /** The newsletter form accepted an address (every outcome looks the same to the visitor). */
  'Newsletter subscribed': { source: string };
  /** The contact form stored a message. */
  'Contact message sent': undefined;
  /** An account was created with a password (it may still have to verify its address). */
  'Signed up': { method: 'password' };
  /** A sign-in completed: with a password (with or without the second factor) or a passkey. */
  'Signed in': { method: 'password' | 'passkey'; twoFactor: boolean };
  /** A sign-in link was sent; the sign-in itself happens from the email. */
  'Magic link requested': undefined;
  /** The browser left for an OAuth provider; the sign-in completes on the callback. */
  'Social sign-in started': { provider: string };
  'Signed out': undefined;
  'Two-factor enabled': undefined;
  'Two-factor disabled': undefined;
  'Passkey added': undefined;
  'Passkey removed': undefined;
  /** A new address was submitted; the change itself may still wait for a link to be opened. */
  'Email change requested': undefined;
  'Account deleted': undefined;
  /** Something was chosen in the command palette: a page, a search result or an action. */
  'Palette item selected': { kind: 'link' | 'result' | 'action'; target: string };
  /** A code block's copy button was used. */
  'Code copied': undefined;
  'Theme changed': { theme: 'light' | 'dark' };
  /** A tab of the deploy-target widget on the home page was opened. */
  'Deploy target viewed': { target: string };
  /** The repository link in the header was followed. */
  'Repository opened': undefined;
}

export type AnalyticsEventName = keyof AnalyticsEvents;

type EventArgs<E extends AnalyticsEventName> = AnalyticsEvents[E] extends undefined
  ? []
  : [properties: AnalyticsEvents[E]];

/**
 * Whether events leave the browser at all; mirrors the `<Analytics />` render in BaseLayout. A
 * build-time constant (astro.config.ts), so with analytics off the client below is never
 * imported and nothing of it is in the bundle.
 */
export const analyticsEnabled: boolean = __ANALYTICS_ENABLED__;

let client: Promise<{ track: typeof track }> | undefined;

/**
 * Records a custom event. Call it on the success path of an interaction, after the server has
 * answered, so a failed request is not counted. Never throws: analytics must not break a page.
 */
export function trackEvent<E extends AnalyticsEventName>(name: E, ...args: EventArgs<E>): void {
  if (!analyticsEnabled) return;
  client ??= import('@vercel/analytics');
  void client
    .then(({ track }) =>
      track(name, args[0] as Record<string, string | number | boolean | null> | undefined),
    )
    .catch(() => {
      // The analytics client only throws outside a browser or in development; a page must not care.
    });
}
