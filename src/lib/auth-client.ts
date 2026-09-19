import { adminClient, magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** Browser-side Better Auth client (same origin, so no baseURL is needed). */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), adminClient()],
});
