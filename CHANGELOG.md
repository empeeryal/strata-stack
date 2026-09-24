# strata-stack

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
