import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, PasswordInput, UNEXPECTED_ERROR } from '../primitives';

interface AuthFormProps {
  mode: 'login' | 'signup';
  /** Where to go after a successful sign-in. Must be a same-site path. */
  redirectTo?: string;
  /** Show the "Forgot password?" link (only when email delivery is configured). */
  passwordReset?: boolean;
}

/** Email + password sign-in and sign-up form backed by Better Auth. */
export default function AuthForm({
  mode,
  redirectTo = '/dashboard',
  passwordReset = false,
}: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();

    try {
      if (mode === 'signup') {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: redirectTo,
        });
        if (result.error) {
          setError(result.error.message ?? UNEXPECTED_ERROR);
          return;
        }
        // Without a session token the address must be verified before signing in.
        if (!result.data?.token) {
          setNotice(
            'Check your inbox: open the verification link we sent to finish creating your account.',
          );
          return;
        }
        window.location.assign(redirectTo);
        return;
      }

      const result = await authClient.signIn.email({ email, password, callbackURL: redirectTo });
      if (result.error) {
        if (result.error.status === 403) {
          setUnverifiedEmail(email);
          setError('Verify your email address before signing in.');
        } else {
          setError(result.error.message ?? UNEXPECTED_ERROR);
        }
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!unverifiedEmail) return;
    setLoading(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL: redirectTo,
      });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      setError(null);
      setNotice('Verification email sent. Open the link in it, then sign in.');
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (notice) {
    return <Alert variant="success">{notice}</Alert>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {error && (
        <Alert>
          {error}
          {unverifiedEmail && (
            <>
              {' '}
              <button
                type="button"
                onClick={resendVerification}
                className="font-medium underline underline-offset-4"
              >
                Resend the verification email
              </button>
            </>
          )}
        </Alert>
      )}
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === 'login' && passwordReset && (
            <a
              href="/forgot-password"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </a>
          )}
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          maxLength={128}
          placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
          aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
        />
        {mode === 'signup' && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 8 characters. A long passphrase or a password manager works best.
          </p>
        )}
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
