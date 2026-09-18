import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Label, PasswordInput, UNEXPECTED_ERROR } from '../primitives';

/** Changes the password of a credential account and signs out other sessions. */
export default function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get('current') ?? '');
    const newPassword = String(data.get('password') ?? '');
    if (newPassword !== String(data.get('confirm') ?? '')) {
      setError('The new passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      form.reset();
      setDone(true);
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Change password">
      {error && <Alert>{error}</Alert>}
      {done && <Alert variant="success">Password updated. Other sessions were signed out.</Alert>}
      <Field>
        <Label htmlFor="current-password">Current password</Label>
        <PasswordInput
          id="current-password"
          name="current"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field>
        <Label htmlFor="change-new-password">New password</Label>
        <PasswordInput
          id="change-new-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Field>
      <Field>
        <Label htmlFor="change-confirm-password">Confirm new password</Label>
        <PasswordInput
          id="change-confirm-password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Field>
      <Button type="submit" variant="outline" loading={loading}>
        Update password
      </Button>
    </form>
  );
}
