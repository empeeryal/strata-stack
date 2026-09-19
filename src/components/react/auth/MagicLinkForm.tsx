import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, UNEXPECTED_ERROR } from '../primitives';

interface MagicLinkFormProps {
  redirectTo?: string;
}

/** Passwordless sign-in: Better Auth emails a one-time link. */
export default function MagicLinkForm({ redirectTo = '/dashboard' }: MagicLinkFormProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('sending');
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    try {
      const result = await authClient.signIn.magicLink({ email, callbackURL: redirectTo });
      if (result.error) {
        setError(result.error.message ?? 'The link could not be sent. Try again.');
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
        Check your inbox: if an account exists for that address, a sign-in link is on its way. The
        link expires in 5 minutes.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field>
        <Label htmlFor="magic-email">Email</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <Button type="submit" variant="outline" className="w-full" loading={status === 'sending'}>
        Email me a sign-in link
      </Button>
    </form>
  );
}
