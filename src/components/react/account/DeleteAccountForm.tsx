import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, PasswordInput, UNEXPECTED_ERROR } from '../primitives';

interface DeleteAccountFormProps {
  /** Whether the account has a password (credential account). */
  hasPassword: boolean;
}

const CONFIRMATION = 'DELETE';

/**
 * Permanently deletes the signed-in user's account through Better Auth. Password accounts
 * confirm with their password; other accounts rely on a recent (fresh) session.
 */
export default function DeleteAccountForm({ hasPassword }: DeleteAccountFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    if (String(form.get('confirm') ?? '') !== CONFIRMATION) {
      setError(`Type ${CONFIRMATION} to confirm.`);
      return;
    }
    const password = String(form.get('password') ?? '');

    setLoading(true);
    try {
      const result = await authClient.deleteUser({
        ...(hasPassword ? { password } : {}),
        callbackURL: '/account-deleted',
      });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      window.location.assign('/account-deleted');
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Delete account">
      <Alert variant="info">
        This removes your account, sessions, connected sign-in methods and, if your email is
        verified, contact messages sent from it. It cannot be undone.
      </Alert>
      {error && <Alert>{error}</Alert>}
      {hasPassword && (
        <Field>
          <Label htmlFor="delete-password">Current password</Label>
          <PasswordInput
            id="delete-password"
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>
      )}
      <Field>
        <Label htmlFor="delete-confirm">Type {CONFIRMATION} to confirm</Label>
        <Input id="delete-confirm" name="confirm" autoComplete="off" required />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" loading={loading}>
          Permanently delete account
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
