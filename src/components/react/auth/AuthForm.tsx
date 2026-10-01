import { type SubmitEvent, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
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
  // Where the verification link lands: the login page, with the destination preserved.
  const verifiedCallback = `/login?verified=1${
    redirectTo === '/dashboard' ? '' : `&next=${encodeURIComponent(redirectTo)}`
  }`;

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
          // The verification link does not sign the clicker in (see src/lib/auth.ts), so it
          // lands on the login page, which explains the next step.
          callbackURL: verifiedCallback,
        });
        if (result.error) {
          setError(result.error.message ?? UNEXPECTED_ERROR);
          return;
        }
        trackEvent('Signed up', { method: 'password' });
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
        // A ban is also a 403; only the verification case gets the resend offer.
        if (result.error.status === 403 && result.error.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email);
          setError('Verify your email address before signing in.');
        } else {
          setError(result.error.message ?? UNEXPECTED_ERROR);
        }
        return;
      }
      // Accounts with two-factor authentication get no session yet: the second step follows.
      const pending = result.data as { twoFactorRedirect?: boolean } | null;
      if (pending?.twoFactorRedirect) {
        const next = redirectTo === '/dashboard' ? '' : `?next=${encodeURIComponent(redirectTo)}`;
        window.location.assign(`/two-factor${next}`);
        return;
      }
      trackEvent('Signed in', { method: 'password', twoFactor: false });
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
        callbackURL: verifiedCallback,
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
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <Alert>
          {error}
          {unverifiedEmail && (
            <>
              {' '}
              <button
                type="button"
                onClick={resendVerification}
                disabled={loading}
                className="font-medium underline underline-offset-4 disabled:opacity-60"
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
          minLength={12}
          maxLength={128}
          placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'}
          aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
        />
        {mode === 'signup' && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 12 characters; a passphrase or a password manager works best. Passwords
            found in known data breaches are refused.
          </p>
        )}
      </Field>
      <Button type="submit" className="w-full" loading={loading}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
