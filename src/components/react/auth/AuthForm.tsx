import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label } from '../primitives';

interface AuthFormProps {
  mode: 'login' | 'signup';
  /** Where to go after a successful sign-in. Must be a same-site path. */
  redirectTo?: string;
}

/** Email + password sign-in and sign-up form backed by Better Auth. */
export default function AuthForm({ mode, redirectTo = '/dashboard' }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();

    const result =
      mode === 'signup'
        ? await authClient.signUp.email({ name, email, password, callbackURL: redirectTo })
        : await authClient.signIn.email({ email, password, callbackURL: redirectTo });

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong. Please try again.');
      setLoading(false);
      return;
    }
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {error && <Alert>{error}</Alert>}
      {mode === 'signup' && (
        <Field>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            placeholder="Ada Lovelace"
          />
        </Field>
      )}
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <Field>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
