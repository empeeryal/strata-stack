import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, UNEXPECTED_ERROR } from '../primitives';

interface TwoFactorFormProps {
  /** Where to go once the second factor is verified. Must be a same-site path. */
  redirectTo: string;
}

/**
 * Second step of a password sign-in for accounts with two-factor authentication: a code from
 * the authenticator app, or one of the backup codes. Better Auth keeps the pending sign-in in
 * a short-lived cookie set by the first step; verifying creates the session.
 */
export default function TwoFactorForm({ redirectTo }: TwoFactorFormProps) {
  const [method, setMethod] = useState<'totp' | 'backup'>('totp');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') ?? '').trim();
    const trustDevice = form.get('trust') === 'on';
    try {
      const result =
        method === 'totp'
          ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({ code, trustDevice });
      if (result.error) {
        setError(
          result.error.status === 401 || result.error.status === 400
            ? method === 'totp'
              ? 'That code did not match. Codes change every 30 seconds; try the current one.'
              : 'That backup code did not match or was already used.'
            : (result.error.message ?? UNEXPECTED_ERROR),
        );
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Two-factor verification">
      {error && <Alert>{error}</Alert>}
      <Field>
        <Label htmlFor="two-factor-code">
          {method === 'totp' ? 'Authenticator code' : 'Backup code'}
        </Label>
        <Input
          key={method}
          id="two-factor-code"
          name="code"
          inputMode={method === 'totp' ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          pattern={method === 'totp' ? '[0-9]{6}' : undefined}
          maxLength={method === 'totp' ? 6 : 32}
          required
          className="font-mono tracking-widest"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trust" className="size-4 rounded border-input" />
        Trust this device for 30 days
      </label>
      <Button type="submit" className="w-full" loading={loading}>
        Verify
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          className="font-medium text-foreground underline underline-offset-4"
          onClick={() => {
            setError(null);
            setMethod(method === 'totp' ? 'backup' : 'totp');
          }}
        >
          {method === 'totp' ? 'Use a backup code instead' : 'Use your authenticator app instead'}
        </button>
      </p>
    </form>
  );
}
