import { type SubmitEvent, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';

import { Alert, Button, Field, Input, Label, PasswordInput, UNEXPECTED_ERROR } from '../primitives';

/**
 * How the change takes effect, decided by the page from the deployment and the account:
 * - `confirm`: a verified address with email delivery; a confirmation link goes to the current
 *   address first, then a verification link to the new one.
 * - `verify`: an unverified address with email delivery; the verification link goes straight to
 *   the new address.
 * - `immediate`: no email delivery and an unverified address; the change applies right away.
 * - `unavailable`: no email delivery and a verified address; nothing could be verified.
 */
export type EmailChangeMode = 'confirm' | 'verify' | 'immediate' | 'unavailable';

export interface ChangeEmailFormProps {
  /** The account's current address. */
  email: string;
  /** Password accounts confirm the change with the password. */
  hasPassword: boolean;
  mode: EmailChangeMode;
}

const EXPLANATIONS: Record<Exclude<EmailChangeMode, 'unavailable'>, string> = {
  confirm:
    'We first send a confirmation link to your current address, then a verification link to the new one. The change takes effect when you open the second link.',
  verify:
    'We send a verification link to the new address. The change takes effect when you open it.',
  immediate: 'The new address takes effect right away.',
};

/** Changes the signed-in user's email address through Better Auth's `changeEmail` endpoint. */
export default function ChangeEmailForm({ email, hasPassword, mode }: ChangeEmailFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Which field the error is about, so assistive technology reads it with that field.
  const [invalidField, setInvalidField] = useState<'email' | 'password' | null>(null);

  if (mode === 'unavailable') {
    return (
      <p className="text-sm text-pretty text-muted-foreground">
        Changing the address needs email delivery, which this site has not configured. Contact the
        site owner.
      </p>
    );
  }

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInvalidField(null);
    setDone(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const newEmail = String(data.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(data.get('password') ?? '');
    if (newEmail === email.toLowerCase()) {
      setInvalidField('email');
      setError('That is already the address on your account.');
      return;
    }

    setLoading(true);
    try {
      // `$fetch` rather than `changeEmail()`: the password travels alongside the request for the
      // `before` hook in src/lib/auth.ts, and the generated method does not know the field.
      const result = await authClient.$fetch('/change-email', {
        method: 'POST',
        body: {
          newEmail,
          callbackURL: '/dashboard?notice=email-change',
          ...(hasPassword ? { password } : {}),
        },
      });
      if (result.error) {
        const message = result.error.message ?? UNEXPECTED_ERROR;
        setInvalidField(
          /password/i.test(message) ? 'password' : /email|address/i.test(message) ? 'email' : null,
        );
        setError(message);
        return;
      }
      trackEvent('Email change requested');
      if (mode === 'immediate') {
        // The response is the same whether the address was taken or applied (the server does
        // not reveal which addresses exist); the session says what the account has now.
        const session = await authClient.getSession();
        if (session.data?.user.email.toLowerCase() === newEmail) {
          window.location.assign('/dashboard?notice=email-updated');
          return;
        }
        setInvalidField('email');
        setError('That address cannot be used for this account.');
        return;
      }
      form.reset();
      setDone(
        mode === 'confirm'
          ? `Check the inbox of ${email} first and confirm the request there. We then send a verification link to ${newEmail}; the change takes effect when you open it.`
          : `Check the inbox of ${newEmail} and open the verification link to finish the change.`,
      );
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Change email address">
      {error && <Alert id="change-email-error">{error}</Alert>}
      {done && <Alert variant="success">{done}</Alert>}
      <p className="text-sm text-pretty text-muted-foreground">{EXPLANATIONS[mode]}</p>
      <Field>
        <Label htmlFor="new-email">New email address</Label>
        <Input
          id="new-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={invalidField === 'email' || undefined}
          aria-describedby={invalidField === 'email' ? 'change-email-error' : undefined}
        />
      </Field>
      {hasPassword && (
        <Field>
          <Label htmlFor="change-email-password">Current password</Label>
          <PasswordInput
            id="change-email-password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={invalidField === 'password' || undefined}
            aria-describedby={invalidField === 'password' ? 'change-email-error' : undefined}
          />
        </Field>
      )}
      <Button type="submit" variant="outline" loading={loading}>
        Change email address
      </Button>
    </form>
  );
}
