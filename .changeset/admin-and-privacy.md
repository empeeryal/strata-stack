---
'astro-framework-v2': minor
---

Operational completeness after the security audit:

- **Email safety.** Without `RESEND_API_KEY`, production requests now fail instead of printing sign-in links to the logs; the magic-link and password-reset UI is hidden until email is configured. Production deployments also validate `BETTER_AUTH_SECRET` at startup.
- **Contact flow.** The honeypot works as documented, submissions are throttled per address and per IP with a persistent store, messages are stored before the owner notification is attempted, delivery status is recorded and retries never duplicate a message.
- **Admin area** (`/admin`) with a message inbox (read, archive, delete, resend notification), user management through Better Auth's admin plugin (roles, bans, session revocation, deletion) and an audit log. Administrators come from `ADMIN_EMAILS` or `pnpm admin:promote`.
- **Account self-service.** Email verification (required when email is configured), password reset, change password, data export and account deletion from the dashboard, plus a retention job (`pnpm db:prune`) and a privacy policy that matches the product.
- **Fixes.** Forms recover from network errors, sign-out reports failures, the sign-up page keeps the `next` destination, the login copy reflects the configured methods, the theme toggle announces its action, docs carry real publication dates and the homepage shows installed versions from the lockfile.
