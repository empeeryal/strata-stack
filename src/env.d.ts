/// <reference path="../.astro/types.d.ts" />

/** Compile-time constant injected from astro.config.ts (see `vite.define`). */
declare const __DEPLOY_TARGET__: 'node' | 'vercel' | 'cloudflare' | 'netlify';

declare namespace App {
  type AuthSession = typeof import('./lib/auth').auth.$Infer.Session;

  interface Locals {
    /** Authenticated user for on-demand routes, populated by src/middleware.ts. */
    user: AuthSession['user'] | null;
    /** Active Better Auth session for on-demand routes. */
    session: AuthSession['session'] | null;
  }
}
