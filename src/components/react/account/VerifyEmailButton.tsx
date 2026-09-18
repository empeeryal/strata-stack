import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, UNEXPECTED_ERROR } from '../primitives';

/** Re-sends the verification email for the signed-in user's address. */
export default function VerifyEmailButton({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setStatus('sending');
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: '/dashboard' });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        setStatus('idle');
        return;
      }
      setStatus('sent');
    } catch {
      setError(UNEXPECTED_ERROR);
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return <Alert variant="success">Verification email sent. Open the link to confirm.</Alert>;
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        loading={status === 'sending'}
      >
        Send verification email
      </Button>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
