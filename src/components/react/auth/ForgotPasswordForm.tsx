import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, UNEXPECTED_ERROR } from '../primitives';

/** Requests a password-reset email. The response is the same whether the address exists. */
export default function ForgotPasswordForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('sending');
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      });
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
    return (
      <Alert variant="success">
        If an account exists for that address, a reset link is on its way. It expires in one hour.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field>
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <Button type="submit" className="w-full" loading={status === 'sending'}>
        Send reset link
      </Button>
    </form>
  );
}
