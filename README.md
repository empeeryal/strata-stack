<p align="center">
  <img src="public/icon-192.png" width="72" height="72" alt="" />
</p>

<h1 align="center">Strata</h1>

<p align="center">
  The layered <a href="https://astro.build">Astro 7</a> stack: auth, content, search and security, already in place.<br />
  Clone it, rename it, deploy it to Vercel, Cloudflare, Netlify or Node.
</p>

<p align="center">
  <a href="https://github.com/empeeryal/strata-stack/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/empeeryal/strata-stack/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Astro 7.3" src="https://img.shields.io/badge/Astro-7.3-BC52EE?logo=astro&logoColor=white" />
  <img alt="Node 24" src="https://img.shields.io/badge/Node-24.x-5FA04E?logo=node.js&logoColor=white" />
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-blue" />
</p>

<p align="center">
  <a href="https://stratastack.dev">Website</a> ·
  <a href="https://stratastack.dev/docs">Documentation</a> ·
  <a href="https://stratastack.dev/blog">Blog</a> ·
  <a href="https://stratastack.dev/changelog">Changelog</a>
</p>

---

Strata is a complete website skeleton **and** the website that documents it. The name spells
the stack: **S**QLite, **T**ailwind, **R**eact, **A**stro, **T**urso and **A**uth, the layers every
production site needs. Every feature listed below runs on [stratastack.dev](https://stratastack.dev),
which is built from this exact code.

## Features

| Area          | What you get                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rendering** | Astro 7.3, static-first output, on-demand routes where needed, Vite 8, Rust compiler                                                                |
| **UI**        | React 19 islands, [Motion](https://motion.dev) animations, Tailwind CSS 4, OKLCH design tokens, flash-free dark mode, self-hosted variable fonts    |
| **Content**   | MDX docs and blog collections, tabs, callouts, steps, table of contents, tags, reading time, RSS, changelog rendered from `CHANGELOG.md`            |
| **Auth**      | [Better Auth](https://better-auth.com): email/password, GitHub, Google, magic links, verification, password reset, protected routes, rate limiting  |
| **Accounts**  | Data export, account deletion, change password; admin area with a contact inbox, user management (roles, bans, sessions) and an audit log           |
| **Data**      | Drizzle ORM + libSQL: a file database locally, [Turso](https://turso.tech) over HTTP in production, migrations, seed script                         |
| **SEO**       | Canonical URLs, generated Open Graph images, JSON-LD, sitemap, robots.txt, web manifest, `llms.txt`, Pagefind search                                |
| **Security**  | Hash-based Content Security Policy, hardened response headers, CSRF origin checks, open-redirect protection, `security.txt`                         |
| **Quality**   | TypeScript strict, ESLint 10, Prettier, Vitest (unit + Container API + React Testing Library), Playwright + axe, Lighthouse CI                      |
| **Delivery**  | One `DEPLOY_TARGET` switch for Vercel, Cloudflare Workers, Netlify and Node; Dockerfile; CI matrix that builds every target; Dependabot; Changesets |

## Quick start

Requires **Node 24** and **pnpm 12** (`corepack enable`).

```bash
git clone https://github.com/empeeryal/strata-stack.git my-site
cd my-site
pnpm install
cp .env.example .env     # defaults work locally with no external services
pnpm db:migrate          # creates .data/local.db
pnpm dev                 # http://localhost:4321
```

Optional: `pnpm db:seed` creates `demo@example.com` and `admin@example.com` (password
`password123`); the admin account opens `/admin`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fempeeryal%2Fstrata-stack&env=BETTER_AUTH_SECRET,BETTER_AUTH_URL,DATABASE_URL,DATABASE_AUTH_TOKEN,SITE_URL)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/empeeryal/strata-stack)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/empeeryal/strata-stack)

| Target             | Command                         | Notes                                                               |
| ------------------ | ------------------------------- | ------------------------------------------------------------------- |
| Vercel             | `pnpm build:vercel`             | Auto-detected; Node 24 from `engines`; CSP as static headers        |
| Cloudflare Workers | `pnpm build:cloudflare`         | `wrangler.jsonc` enables `nodejs_compat`; prerendering runs in Node |
| Netlify            | `pnpm build:netlify`            | `netlify.toml` sets Node 24 and the publish directory               |
| Node / Docker      | `pnpm build:node && pnpm start` | Multi-stage `Dockerfile` with health check                          |

`DEPLOY_TARGET` is inferred from `VERCEL`, `NETLIFY` and `WORKERS_CI`, so the platform build
command can stay `astro build`. See the [deploy guides](https://stratastack.dev/docs/deploy/choosing-a-target).

## Environment variables

| Variable                                           | Required   | Purpose                                                                                |
| -------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                     | yes        | `file:./.data/local.db` locally, `libsql://…` in production                            |
| `DATABASE_AUTH_TOKEN`                              | production | Turso token                                                                            |
| `BETTER_AUTH_SECRET`                               | yes        | ≥ 32 random bytes (`openssl rand -base64 32`)                                          |
| `BETTER_AUTH_URL`                                  | yes        | Public origin as a full URL, e.g. `https://example.com`                                |
| `SITE_URL`                                         | no         | Canonical origin; defaults to the Vercel/Netlify production URL, then `siteConfig.url` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`        | no         | Enables GitHub sign-in                                                                 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`        | no         | Enables Google sign-in                                                                 |
| `RESEND_API_KEY`, `EMAIL_FROM`, `CONTACT_TO_EMAIL` | no         | Magic links, verification, password resets, contact notifications                      |
| `ADMIN_EMAILS`                                     | no         | Addresses that get the `admin` role on sign-up (or `pnpm admin:promote`)               |
| `HEALTH_TOKEN`                                     | no         | Bearer token that unlocks the detailed `/api/health` response for monitors             |
| `PUBLIC_ANALYTICS`                                 | no         | `none` (default) or `vercel`                                                           |

The full list with platform notes lives in [`.env.example`](.env.example) and the
[environment variables guide](https://stratastack.dev/docs/guides/environment-variables).

## Scripts

| Script                                                                   | Description                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------- |
| `pnpm dev`                                                               | Development server                                  |
| `pnpm build` / `pnpm build:<target>`                                     | Production build (target auto-detected or explicit) |
| `pnpm preview` / `pnpm start`                                            | Preview the build / run the Node server             |
| `pnpm check` · `pnpm lint` · `pnpm format`                               | Type-check, lint, format                            |
| `pnpm test` · `pnpm test:e2e` · `pnpm test:a11y`                         | Vitest, Playwright, axe checks                      |
| `pnpm lhci`                                                              | Lighthouse budgets                                  |
| `pnpm db:migrate` · `db:generate` · `db:studio` · `db:seed` · `db:reset` | Database                                            |
| `pnpm db:prune` · `pnpm admin:promote <email>`                           | Retention job, grant the admin role                 |
| `pnpm auth:generate`                                                     | Regenerate the Better Auth schema                   |
| `pnpm changeset`                                                         | Record a change for the changelog                   |

## Project structure

```text
astro.config.ts         adapter switch, CSP, fonts, integrations
config/                 adapter resolver, security headers
integrations/           theme script, security headers
src/
  actions/              Astro Actions (contact form, admin operations)
  components/           ui primitives, site chrome, React islands, SEO head
  content/              docs, blog, authors, legal (MDX/JSON) + changelog loader
  db/                   Drizzle client and schema (auth schema generated)
  layouts/              Base, Docs, Blog, Auth, Admin
  lib/                  auth, email, env, contact, throttle, admin, seo, utils
  middleware.ts         session + security headers
  pages/                routes and endpoints (admin area, account export, og images, rss, api)
  site.config.ts        the one file to edit when rebranding
  styles/global.css     Tailwind 4 + design tokens
tests/                  unit (Vitest) and e2e (Playwright)
```

A full tour is in the [project structure docs](https://stratastack.dev/docs/getting-started/project-structure).

## Renaming for a new project

Start with `src/site.config.ts` (name, tagline, URL, author, repository, navigation), then work
through the [rename checklist](https://stratastack.dev/docs/getting-started/installation#rename-checklist)
for the icons, legal pages and changelog.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © empeeryal
