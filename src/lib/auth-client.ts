import { adminClient, magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side Better Auth client (same origin, so no baseURL is needed). The sign-in form
 * handles the two-factor redirect itself (see AuthForm.tsx), so the client plugin only adds
 * the `twoFactor.*` methods.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), adminClient(), twoFactorClient()],
});
