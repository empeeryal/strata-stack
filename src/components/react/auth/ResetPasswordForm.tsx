import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Label, PasswordInput, UNEXPECTED_ERROR } from '../primitives';

interface ResetPasswordFormProps {
  /** Token from the reset link (`?token=`). */
  token: string;
}

/** Sets a new password using the token from the reset email. */
export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    if (newPassword !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setStatus('saving');
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        setStatus('idle');
        return;
      }
      setStatus('done');
    } catch {
      setError(UNEXPECTED_ERROR);
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <Alert variant="success">
        Your password has been updated and other sessions were signed out.{' '}
        <a href="/login" className="font-medium underline underline-offset-4">
          Sign in
        </a>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field>
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          placeholder="At least 8 characters"
        />
      </Field>
      <Field>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Field>
      <Button type="submit" className="w-full" loading={status === 'saving'}>
        Update password
      </Button>
    </form>
  );
}
