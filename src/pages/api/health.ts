import type { APIRoute } from 'astro';

import pkg from '../../../package.json';

export const prerender = false;

/** Lightweight liveness endpoint for uptime checks and deploy verification. */
export const GET: APIRoute = () =>
  Response.json(
    {
      status: 'ok',
      name: pkg.name,
      version: pkg.version,
      target: __DEPLOY_TARGET__,
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
