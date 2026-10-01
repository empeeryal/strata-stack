import type { APIRoute } from 'astro';

import { auth } from '@/lib/auth';

// Better Auth handles every request under /api/auth/* (sign-in, sign-up, OAuth callbacks…).
export const prerender = false;

export const ALL: APIRoute = (context) => {
  // Forward the client address resolved by the adapter so rate limiting works on
  // every platform (Better Auth reads `x-forwarded-for` by default).
  const headers = new Headers(context.request.headers);
  try {
    headers.set('x-forwarded-for', context.clientAddress);
  } catch {
    // clientAddress is unavailable in some environments. The header the visitor sent must not
    // stand in for it: Better Auth would key its limits on a value they chose.
    headers.delete('x-forwarded-for');
  }
  return auth.handler(new Request(context.request, { headers }));
};
