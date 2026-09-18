# astro-framework-v2

## 0.2.0

### Minor Changes

- 9097054: Operational completeness after the security audit:
  
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
