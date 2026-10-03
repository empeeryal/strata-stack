import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';

import { Alert, Button, UNEXPECTED_ERROR, useWebAuthnSupport } from '../primitives';

interface PasskeyButtonProps {
  /** Where to go after a successful sign-in. Must be a same-site path. */
  redirectTo?: string;
}

/** Error codes the browser reports when nothing was chosen: a closed prompt, a timeout. */
const CANCELLED = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
]);

export function describePasskeyError(error: {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}): string {
  if (error.code && CANCELLED.has(error.code)) {
    return 'No passkey was used. Try again, or sign in another way.';
  }
  if (error.status === 401) {
    return 'That passkey is not registered here any more. Sign in another way and add it again from the dashboard.';
  }
  return error.message ?? UNEXPECTED_ERROR;
}

function finish(redirectTo: string) {
  trackEvent('Signed in', { method: 'passkey', twoFactor: false });
  window.location.assign(redirectTo);
}

/**
 * Sign-in with a passkey (WebAuthn) through Better Auth's passkey plugin. Besides the button,
 * browsers that support it get the saved passkeys offered in the email field's autofill
 * (conditional mediation); choosing one there signs in without a click here.
 */
export default function PasskeyButton({ redirectTo = '/dashboard' }: PasskeyButtonProps) {
  const supported = useWebAuthnSupport();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const available = await window.PublicKeyCredential.isConditionalMediationAvailable?.();
        if (!available || cancelled) return;
        // Resolves when a passkey is picked from the autofill list; the button's own ceremony
        // or leaving the page ends it with a cancellation, which is not an error to show.
        const result = await authClient.signIn.passkey({ autoFill: true });
        if (cancelled || !result || result.error) return;
        finish(redirectTo);
      } catch {
        // Autofill is a convenience; the button still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, redirectTo]);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.passkey();
      if (!result || result.error) {
        setError(result?.error ? describePasskeyError(result.error) : UNEXPECTED_ERROR);
        return;
      }
      finish(redirectTo);
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <Button type="button" variant="outline" className="w-full" onClick={signIn} loading={loading}>
        <KeyRound aria-hidden="true" />
        Sign in with a passkey
      </Button>
    </div>
  );
}
