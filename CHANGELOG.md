# strata-stack

## 0.24.0

### Minor Changes

- 7607f84: Fourth audit: findings verified against the code and fixed.
  
  - **Newsletter.** Confirming a subscription is a button that posts an action, like unsubscribing: mail clients and link scanners fetch the links in an email, and a fetch must not subscribe an address somebody else typed into the form. An opt-out the provider has not been told about is never pruned and is retried by the weekly job (`RESEND_API_KEY` and `RESEND_AUDIENCE_ID` in the Prune workflow), by the next change to the address and when an administrator removes it; the admin overview counts addresses the provider still misses. A retried webhook delivery older than the address's current confirmation is ignored instead of undoing it. A site-wide cap of 120 confirmation emails an hour bounds abuse when the per-IP rule is defeated. The subscribe action refuses when the newsletter is turned off. `audience.add` looks the contact up before creating it. A malformed `RESEND_WEBHOOK_SECRET` refuses deliveries instead of failing with a 500. The CSV export writes addresses as they are (`-deals@example.com` is valid and a leading apostrophe would break it).
  - **Authentication.** The verification link no longer signs the clicker in: it proves who owns the mailbox, not who chose the password, and an account somebody else registered in your name would otherwise come with a session. It lands on the login page with a notice; `ADMIN_EMAILS` without `RESEND_API_KEY` is refused in production because nothing would protect those addresses. Trusted browsers for two-factor authentication are forgotten on password change and reset, "sign out everywhere" (own or by an administrator) and bans. Deleting a password account always needs the password. A banned account sees the ban message instead of "verify your email". Expired sessions are hidden from the dashboard and the export and deleted by the prune job. The cookie cache lasts one minute. The export is limited to ten downloads an hour. The login page explains OAuth callback errors. The Node auth route drops a client-sent `X-Forwarded-For` when the adapter has no address.
  - **Platform.** `pnpm start` sets `NODE_ENV=production`. The sitemap lists pages in their canonical form (no trailing slash) and the Cloudflare target serves them there. Prerendered pages on the Node target carry the security headers without a reverse proxy, and the CSP gains `frame-ancestors 'none'`. An empty `BETTER_AUTH_URL` no longer hides `SITE_URL`. Third-party actions are pinned to commits. The Node deployment guide explains why the proxy must set `X-Forwarded-For` rather than append to it.
  - **Quality.** The accessibility suite signs in with its own administrator and asserts the page it scans; `PASSWORD_BREACH_CHECK=false` runs the end-to-end suite offline. Secondary auth controls hydrate on idle. Client-side validation errors are associated with their field. An `--overlay` token replaces the raw palette classes behind dialogs; the avatar classes are shared between Astro and React. Unused exports are gone, `src/lib/email.ts` and the integrations are measured for coverage, and the documentation drift the review found is corrected.

## 0.23.0

### Minor Changes

- d105e39: Back-to-top button. Every page gets a fixed button (`src/components/ui/BackToTop.astro`, rendered by `BaseLayout`) that appears once the page has been scrolled about a screen, scrolls back to the top and moves focus to the main landmark, so keyboard and screen-reader users land at the start of the content. It respects the reduced-motion preference through the page's `scroll-behavior`, needs no island, and the main element now carries `tabindex="-1"` so both it and the skip link can move focus there.

### Patch Changes

- d105e39: Lighthouse now audits the Node build through a small gzip proxy (`scripts/lhci-server.mjs`). The standalone Node server serves text uncompressed while every supported deployment compresses it, and the raw numbers put the mobile pages about ten points below what visitors see, close enough to the floors that a slow CI runner failed the release. The author avatar is requested at the size it is shown (`?size=112`) instead of the full 625 KB GitHub original.
- 1203975: Opening the dashboard no longer records an account export. Astro's `prefetchAll` fetched the "Download my data" link as soon as it scrolled into view, which ran the export and wrote an `account.export` audit entry without a click. Both audited downloads, the account export and the admin's subscriber CSV, are now POST forms; a GET to either answers 405. The guides and the agent guidance state the rule: a GET endpoint with a side effect fires without a click on a site that prefetches its links.
- 1203975: Blog post: "The third review: floors, a longer yardstick and a hero with no LCP", on the coverage floors, the wider Lighthouse run and what it found, the password rules, and the dashboard export that prefetching triggered.

## 0.22.0

### Minor Changes

- 8545889: Assurance depth, after a third outside review:
  
  - **Passwords** must be at least 12 characters (was 8) and are refused when they appear in Have I Been Pwned's breach corpus, through Better Auth's `haveIBeenPwned` plugin (a k-anonymity lookup: only the first five characters of the password's SHA-1 hash leave the server). Applies at sign-up, password change and reset; existing passwords are unaffected until changed. `PASSWORD_BREACH_CHECK=false` turns the lookup off. The forms state both rules and the guide has a new "Password rules" section.
  - **Coverage floors.** `vitest.config.ts` sets minimum line, branch, function and statement coverage per file group (`src/lib`, `config`, the React islands); the `unit` job fails below them. Files only a running server exercises are left to the Playwright suite. Nine islands that had no unit tests (the change-password, delete-account, verify-email, forgot-password, magic-link, reset-password, sign-out and social buttons, and the deploy-target tabs) and the Resend audience adapter have them now; the auth form's unverified-address, check-your-inbox and reset-link paths are covered too.
  - **Lighthouse** runs three times per URL and asserts on the median, in a desktop configuration (home, docs, blog post, pricing table, search, login) and a new mobile configuration (home, docs, blog post). The performance score now blocks like the other categories; `/login` is exempt from the SEO score because it is `noindex` on purpose.
  - Two things the wider Lighthouse run found and this release fixes: the pricing table's scoped `<style>` was refused by the Content Security Policy on the docs page that imports the component directly (the rule moved to `global.css`, and the CSP end-to-end check now covers that page), and the search page shifted its layout when results arrived (the results region keeps its height). The mobile run also showed the home page without a Largest Contentful Paint candidate: the hero faded in from `opacity: 0`, which excludes it from LCP. The headline, lead paragraph and quick-start block now use a new transform-only `animate-rise` utility; the badge and buttons keep fading.

## 0.21.0

### Minor Changes

- 85f258a: The site ships in English only again. The German locale from 0.20.0 (the `/de` pages, the translated
  blog post, the language switcher, the German dictionary and home page copy) is removed: with the
  documentation and the signed-in areas in English, most links from a German page led back to
  English, and a browser's own translation did a better job than a site translated in patches. The
  i18n plumbing stays, configured for one locale: Astro's i18n routing, `src/i18n` with the
  dictionaries and path helpers, per-locale home page copy, the content and docs locale helpers and
  the `hreflang` output in `Head.astro`, so a project built on the template can add a language by
  following the (rewritten) internationalisation guide. With one locale nothing in the markup mentions
  another language, and `/de` is a 404.

## 0.20.1

### Patch Changes

- ae4f53d: Second audit of the template, with fixes across the stack:
  
  - **Search Console:** the docs breadcrumb trail names an `item` for the section crumb, so the BreadcrumbList structured data validates again.
  - **Redirects:** `safeRedirect()` rejects paths that normalise to a protocol-relative URL (`/..//host`), and resolves `..` segments before checking them.
  - **Production config:** a placeholder `BETTER_AUTH_SECRET` and a missing public URL are errors; a non-https URL is a warning. `getSiteUrl()` falls back to the platform's production URL.
  - **Node behind a proxy:** `security.allowedDomains` is filled in from the site URL (`config/trusted-hosts.ts`), so `X-Forwarded-For` is trusted for the site's own host and rate limiting keys on the visitor, not the proxy.
  - **Caching:** `/api/health` and requests with an `Authorization` header are never cached; the guide states plainly that a stored public copy is served to signed-in visitors too. The GitHub stats endpoint memoises the upstream call for two minutes so a cold cache cannot fan out to GitHub.
  - **Two-factor:** resetting a user's second factor also forgets their trusted devices; disabling it does the same. Backup-code regeneration is audited, enabling is audited once. The sign-in step explains an expired or used-up attempt (five wrong codes, ten minutes) and a temporary lock.
  - **Accounts:** deleting the last active administrator's own account is refused atomically. Signing out other sessions is audited. Names are normalised on sign-up.
  - **Newsletter:** confirmation links expire after seven days; the pending, confirmed and unsubscribed transitions are race-safe; a concurrent first-time subscribe keeps one row. Removing a subscriber goes through `removeSubscriber()` and reports when the Resend segment could not be updated. The CSV export neutralises spreadsheet formulas.
  - **Throttles** are keyed with an HMAC of `BETTER_AUTH_SECRET` instead of a plain hash.
  - **Contact:** control characters are stripped from the notification subject.
  - **Accessibility:** ban reasons and delivery errors in the admin tables are read out with their badges; the copy button in the two-factor setup announces its state.
  - **Dependencies:** `undici` is overridden to 7.29.1 (GHSA-3wwx-pv8p-q78v, dev-only through miniflare).
  - Dead code and duplicates removed (`fnv1a`, `describeError`, `hasAdminRole`, `newsletterLabels`, unused CSS tokens), docs brought in line with the code.
- 14e7b2b: Blog post: "The second audit: redirects, proxies and which way a cache promise points", on what the second review found and how the fixes landed.

## 0.20.0

### Minor Changes

- c52ccfd: Internationalisation layout. Astro's i18n routing is enabled with English at the root and German
  under `/de`: the header, navigation, footer, search trigger, theme toggle, account menu and skip
  link read their strings from `src/i18n/ui.ts`, a language switcher in the header links to the
  translation of the current page (or the other home page), and `Head.astro` emits `hreflang` and
  `og:locale` alternates. The home page, the about page and the blog are translated; blog posts are
  translated by adding a file with the same slug under `src/content/blog/<locale>/`, the German index
  lists the untranslated English posts after the German ones, and `/de/rss.xml` carries the German
  feed. The documentation and the signed-in areas stay English. New guide:
  docs/guides/internationalisation.

## 0.19.0

### Minor Changes

- 41b4880: Route caching for server-rendered responses. `astro.config.ts` now configures Astro's cache
  provider per deploy target (`config/cache.ts`: the platform CDN on Vercel, Netlify and
  Cloudflare, the server's memory on Node) and a `routeRules` entry for the first cached route,
  `/api/repo-stats`, which returns the repository's star and fork counts for a new badge next to the
  GitHub link in the header. The middleware keeps the cache off for anything personal: non-GET
  requests, visitors with a Better Auth cookie or session, and the account, admin, auth and
  newsletter-token routes (`src/lib/caching.ts`). New guide: docs/guides/caching.

## 0.18.0

### Minor Changes

- c83cfc8: Two-factor authentication through Better Auth's plugin: a dashboard card (`TwoFactorSetup`) that
  turns time-based one-time passwords on with the password, a QR code and the first code from the
  app, shows ten backup codes, regenerates them and turns the factor off; a `/two-factor` page
  (`TwoFactorForm`) after a password sign-in for the code or a backup code, with a 30-day trusted
  device option; an admin badge and a **Reset 2FA** action for people who lost both; audit entries
  when it is turned on, off or reset; migration `0004` (the `two_factor` table and
  `user.two_factor_enabled`). The TOTP secret and backup codes are stored encrypted with
  `BETTER_AUTH_SECRET`.

## 0.17.0

### Minor Changes

- ea3941d: Newsletter: unsubscribes made through Resend now reach the site. A new endpoint,
  `POST /api/newsletter/webhook`, verifies Resend's signed contact webhooks (`contact.updated`,
  `contact.deleted`) with `RESEND_WEBHOOK_SECRET`, marks the address unsubscribed and records it
  in the audit log; it never re-subscribes anyone. The provider mirror uses Resend's segments API
  (`RESEND_AUDIENCE_ID` holds the segment ID; older dashboards call them audiences), and the admin
  overview shows whether the webhook is configured. The roadmap drops the scheduled retention
  item, which the Prune data workflow already delivers.

## 0.16.1

### Patch Changes

- bf4b388: Dependency updates from the 28 September Dependabot run, applied together: Astro 7.3.5 with
  `@astrojs/react` 7, `@astrojs/mdx` 8.0.2, `@astrojs/cloudflare` 14.3.3 and `@astrojs/vercel`
  11.0.11; Better Auth 1.7.6 with its Drizzle adapter, `drizzle-orm` 0.45.3, `drizzle-kit`
  0.31.11 and `resend` 6.29; `lucide-react` 1.48, `motion` 13.4.4, `satori` 0.33.5, the Iconify
  icon sets, `@types/node`, `wrangler` 4.142, and the tooling (Vitest 5.0.2, ESLint 10.11,
  Prettier 3.9.9 with `prettier-plugin-astro` 1.1, `typescript-eslint` 8.70.1). The Vitest config
  turns the dev toolbar off so the new Astro no longer annotates Container API output with source
  locations, which the component tests compare literally.

## 0.16.0

### Minor Changes

- c918085: The dashboard's session list is now an island, `SessionList`, that renders the same forms the
  page handled before (so signing out a session still works without JavaScript through the
  redirect and notice) and, once hydrated, submits them through the actions client and updates
  the list in place. The badge styles moved to `src/components/ui/badge-variants.ts`, shared by
  `Badge.astro` and a React `Badge`.

## 0.15.0

### Minor Changes

- 419f8db: Profile editing on the dashboard: a `ProfileForm` island changes the name and avatar through
  Better Auth's `updateUser`, validated in the island and again in a `user.update` database hook
  (`src/lib/profile.ts`: names of 2 to 80 characters, avatars as `https://` links only). A new
  `Avatar` component (Astro and React) shows the image or the person's initials in the header,
  the dashboard and the admin users list.

## 0.14.0

### Minor Changes

- 7826fb2: Newsletter with double opt-in: a `NewsletterForm` island in the footer, after blog posts and on
  `/newsletter` (which also handles the form without JavaScript), `newsletter.subscribe` and
  `newsletter.unsubscribe` actions with the contact form's honeypot and throttles, confirmation and
  unsubscribe pages, a `newsletter_subscriber` table (migration `0003`), an optional Resend
  audience mirror through `RESEND_AUDIENCE_ID`, an `/admin/subscribers` page with a CSV export
  of confirmed addresses and their unsubscribe links, the subscription in the account data export,
  and pruning of unconfirmed and unsubscribed addresses after `NEWSLETTER_RETENTION_DAYS`. The
  home page code block gets a copy button, shared with the Markdown code blocks.

## 0.13.0

### Minor Changes

- d2c23a9: New **pricing table** component: `PricingTable.astro` renders tiers as cards with a highlighted
  plan, badge, feature list, call to action and custom pricing, plus a monthly/annual switch that
  stays hidden without JavaScript and is driven by a processed script rather than an island. The
  Components docs gain a page with a live example, and the roadmap's three islands are complete.

## 0.12.0

### Minor Changes

- e6d28a4: New **bar chart** component: `BarChart.astro` draws a column chart as inline SVG with no
  JavaScript, coloured by a new `--chart-1` token (the primary hue, a darker step in dark mode),
  with a peak label, native tooltips and a table view. The admin overview shows messages received
  per day for the last thirty days, and the Components docs gain a page for the chart.

## 0.11.0

### Minor Changes

- c35ca31: New **command palette** island: <kbd>Ctrl</kbd>+<kbd>K</kbd> or the header trigger opens a
  native-dialog palette listing the site's pages, every docs page, a few actions (switch theme,
  copy link, sign in or dashboard, admin area) and live Pagefind results, replacing Pagefind's
  modal in the header. The triggers stay links to `/search`, which remains the route without
  JavaScript and now hosts the Pagefind components. A new **Components** docs section documents the
  islands, starting with the palette.

## 0.10.5

### Patch Changes

- bceeea2: The operating guide gains a checklist of the GitHub repository settings a project started from
  the template needs (security features, the `main` ruleset, Actions permissions, where each
  secret lives), a new blog post covers going public, and the announcement post points at the
  **Use this template** button.

## 0.10.4

### Patch Changes

- 700b175: The Release workflow opens the version pull request with a `RELEASE_TOKEN` secret when one
  exists, so CI, CodeQL and the branch rules apply to that pull request too; without the secret it
  falls back to the built-in token as before. The CI and operating guides explain the token's
  permissions and expiry.

## 0.10.3

### Patch Changes

- af1de8b: The README and the installation guide start a new project from GitHub's **Use this template**
  button, with Astro's CLI and a plain clone as alternatives, and the rename checklist now covers
  `CODEOWNERS`, the README badges and deploy buttons, the issue-template advisory link, the old
  announcement redirect and Strata's own blog and docs content.

## 0.10.2

### Patch Changes

- e62057e: Dependency audit housekeeping: `fflate` inside the Open Graph image generator is pinned to the
  patched 0.7.5, the esbuild advisory reached through drizzle-kit's config loader is recorded as a
  build-time exception, and the CI guide lists every audit exception with the reason for it.

## 0.10.1

### Patch Changes

- cdc2ce9: New **Operating the site** guide: the runbook for a deployed site (first-deployment steps,
  scheduled jobs, monitoring, administrators, incidents, rotating secrets, releases, backups) with
  links from the CI, admin and Vercel guides and the README. The session-cache and contact-flow
  blog posts carry dated update notes for the changes since they were written, and the
  announcement post lists the workflows.

## 0.10.0

### Minor Changes

- bbd4011: The dashboard lists every session on the account with the browser, platform, address and
  times, and lets people sign out of any single session or of all the others. The users page
  in the admin area is searchable by name or email. The contact form shows a live character
  counter for the message. The docs say which pages need JavaScript.

## 0.9.0

### Minor Changes

- e3ef067: The audit log is paginated (25 entries per page) and can be filtered by action, by actor or
  target and by date range, with the filters kept in the URL. The accessibility suite now also
  scans the signed-in dashboard and admin pages and interactive states such as the open mobile
  navigation, the search dialog, form errors and the account-deletion form. The new scans found and fixed three contrast problems in the
  light theme: the success and danger text colours on tinted alerts and badges, and search
  highlights, which Pagefind renders as text in the `--pf-mark` colour rather than as a
  background.

## 0.8.1

### Patch Changes

- d6d2bc9: The last-administrator rule for the admin actions is now enforced inside the SQL statement
  that changes the role, bans or deletes the account, so two administrators acting on each
  other at the same moment cannot leave the site without an administrator. Those three changes
  write their audit entry in the same transaction.

## 0.8.0

### Minor Changes

- 4f9f9b5: Hardening from the September audit: the dashboard and the detailed health response decide
  access from the database instead of the cookie cache; resending a contact notification takes a
  short lease on the message first, so concurrent retries send one email; the contact table gains indexes for
  the inbox and overview queries (migration `0002`); the administrator count on the overview
  follows the same role rule as authorization; a weekly **Prune data** workflow runs the retention
  job; banning asks for an optional reason; posts dated in the future wait for their date; the
  search shortcut hint no longer relies on the deprecated platform string alone.

## 0.7.3

### Patch Changes

- 00f6d88: Contact notifications set `Reply-To` to the visitor's name and address, so replying from your
  mail client answers the visitor directly.

## 0.7.2

### Patch Changes

- fd5ed40: Every deploy guide, the FAQ, the README and the scripts reference now explain how the production
  tables are created with the **Migrate database** workflow; the project structure and agent guides
  mention it too. Page revision dates reflect the actual last changes.

## 0.7.1

### Patch Changes

- 24d3cea: The **Migrate database** workflow also reads the `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
  secrets, logs which of the accepted secret names the job can see, and explains where to add
  them when none is found.

## 0.7.0

### Minor Changes

- 8604313: Production migrations from GitHub Actions: the new **Migrate database** workflow applies the
  migrations in `drizzle/` with `pnpm db:migrate`, on demand or automatically when a merged
  change adds one. It reads `DATABASE_URL` and `DATABASE_AUTH_TOKEN` from repository secrets.
  The database settings also accept `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, the names
  Turso's Vercel integration sets, so no renaming is needed there.

## 0.6.0

### Minor Changes

- db9b74c: The template is now **Strata** (`strata-stack`), published at https://stratastack.dev. The name
  spells the stack: SQLite, Tailwind, React, Astro, Turso and Auth. Site name, tagline, canonical
  URL, repository links, package and Worker names, the security contact and the docs are updated;
  the design is unchanged. The announcement post moved to `/blog/introducing-strata` and the old
  address redirects.

## 0.5.1

### Patch Changes

- 5fded12: The home page headline keeps its gradient but no longer animates it. The sliding gradient
  regularly left "Astro" and "7" in different colours, with the number on the dimmer end; the
  static primary-to-accent sweep reads as one phrase.

## 0.5.0

### Minor Changes

- c548b72: The template now requires pnpm 12 (`packageManager: pnpm@12.4.2`). pnpm's settings moved from
  the `pnpm` field in `package.json` to `pnpm-workspace.yaml`: allowed build scripts
  (`allowBuilds`), transitive `overrides` and `auditConfig.ignoreGhsas`. The lockfile was
  regenerated with pnpm 12. With pnpm 12, Dependabot's release-age gate applies only to the
  packages being updated instead of every lockfile entry, so update runs no longer fail while a
  recently published package sits in the lockfile.

## 0.4.0

### Minor Changes

- 83890a7: Repository-wide cleanup.
  
  - **Header shows the signed-in state on prerendered pages.** A small `<account-menu>` element
    fetches the session once per page and swaps the "Sign in" link for the account and admin
    links; server-rendered pages still get it from `Astro.locals`.
  - **Admin inbox** can be filtered by notification status (`?delivery=failed`, linked from the
    dashboard); statuses use readable labels (New, Read, Archived; Pending, Sent, Failed, Skipped)
    and share one pagination component with the blog and users pages.
  - **Docker image** ships `scripts/migrate.ts` so migrations run with production dependencies
    only (`docker run --rm --env-file .env astro-framework node scripts/migrate.ts`); Drizzle Kit,
    the adapters and the other build-time packages are now dev dependencies.
  - **Retention job** moved into `src/lib/retention.ts` with unit tests; `pnpm db:prune` prints
    what it removed.
  - **Smaller surface**: unused exports (`requireEnv`, `pruneThrottle`, `POSTS_PER_PAGE`, the
    `EmailNotConfiguredError` class, re-exported auth client helpers) and stale configuration
    (`.npmrc`, `.node-version`, `wrangler types` on every Cloudflare build) are gone; CI installs
    through one composite action and caches the Playwright browser.
  - Copy, comments and docs were rewritten to describe the current behaviour without history.

## 0.3.0

### Minor Changes

- e126ecd: Admin hardening.
  
  - **Authorization is read from the database** for the admin pages, the admin actions and the
    account export (`getAuthoritativeSession()`), instead of the five-minute session cookie
    cache. Removing the admin role, banning or "sign out everywhere" now applies to the very next
    request.
  - **Opening a message no longer mutates on GET.** Marking a message read is an audited POST
    action triggered when a person opens it (or via the new "Mark as read" button); inbox links
    disable prefetching. Previously Astro's viewport prefetch marked every visible message read.
  - **Inbox pagination and search**: 25 messages per page with "Showing x–y of n", plus a filter
    by sender name or email. "Mark as unread", read/archive/delivery timestamps on the detail
    page and a confirmation notice after every admin action.
  - **Last-admin protection**: the last active administrator cannot be demoted, banned, deleted
    or delete their own account; `pnpm admin:promote --revoke` refuses without `--force`.
  - **Audit log**: message actions and their entries are written in one transaction
    (`writeAudit()`); Better Auth user operations stay best-effort and the UI and docs say so.
  - `/api/health` returns only `status` and `time` to anonymous callers; administrators and
    requests with `Authorization: Bearer <HEALTH_TOKEN>` get the full checks.
  - `CONTACT_MAX_AGE_DAYS` (optional) lets `pnpm db:prune` enforce a maximum age for messages of
    any status; the privacy policy and guide describe the retention rules precisely.

## 0.2.0

### Minor Changes

- 9097054: Operational completeness:
  
  - **Email safety.** Without `RESEND_API_KEY`, production requests now fail instead of printing sign-in links to the logs; the magic-link and password-reset UI is hidden until email is configured. Production deployments also validate `BETTER_AUTH_SECRET` at startup.
  - **Contact flow.** The honeypot works as documented, submissions are throttled per address and per IP with a persistent store, messages are stored before the owner notification is attempted, delivery status is recorded and retries never duplicate a message.
  - **Admin area** (`/admin`) with a message inbox (read, archive, delete, resend notification), user management through Better Auth's admin plugin (roles, bans, session revocation, deletion) and an audit log. Administrators come from `ADMIN_EMAILS` or `pnpm admin:promote`.
  - **Account self-service.** Email verification (required when email is configured), password reset, change password, data export and account deletion from the dashboard, plus a retention job (`pnpm db:prune`) and a privacy policy that matches the product.
  - **Fixes.** Forms recover from network errors, sign-out reports failures, the sign-up page keeps the `next` destination, the login copy reflects the configured methods, the theme toggle announces its action, docs carry real publication dates and the homepage shows installed versions from the lockfile.

## 0.1.1

### Patch Changes

- 3df199f: Builds no longer fail with "Invalid URL" when `SITE_URL` is empty or has no scheme: the canonical URL now falls back to the production URL Vercel or Netlify inject, then to `siteConfig.url` (see `config/site-url.ts`). CI fixes: the `.data` directory is tracked so the e2e database can be created on a fresh checkout, the e2e database is reset before the test server starts, and Lighthouse binds `127.0.0.1` explicitly.

## 0.1.0

### Minor Changes

- Initial release of the template. Includes Astro 7.3 with the Rust compiler and Sätteri Markdown
  pipeline, React 19 islands animated with Motion, Tailwind CSS 4 with OKLCH design tokens and a
  flash-free dark mode, Better Auth with email/password, GitHub, Google and magic-link sign-in,
  Drizzle ORM with libSQL (file database locally, Turso in production), MDX documentation and blog
  collections with tabs, callouts, steps, table of contents, tags and RSS, generated Open Graph
  images, JSON-LD, sitemap, robots.txt and llms.txt, Pagefind search, a hash-based Content Security
  Policy with hardened response headers, Vitest and Playwright test suites with axe accessibility
  checks, and one-config deployment to Vercel, Cloudflare, Netlify and Node.
