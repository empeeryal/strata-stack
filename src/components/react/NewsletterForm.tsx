import { actions, isInputError } from 'astro:actions';
import { type SubmitEvent, useId, useState } from 'react';

import type { NewsletterSource } from '@/lib/newsletter';
import { cn } from '@/lib/utils';

import { Alert, Button, Input, Label, UNEXPECTED_ERROR } from './primitives';

export interface NewsletterFormProps {
  /** Where the form is placed; stored with the subscription for the owner's information. */
  source?: NewsletterSource;
  /** Single row of input and button, for the footer. The default stacks them on small screens. */
  compact?: boolean;
  /** Extra classes for the form element. */
  className?: string | undefined;
}

/** Shown after a successful request whatever the outcome, so the form reveals nothing. */
export const SUBSCRIBED_MESSAGE =
  'Check your inbox: we sent you a link to confirm the subscription. Nothing is sent until you open it.';

/**
 * Newsletter sign-up submitted through the `newsletter.subscribe` action. Works from static
 * pages because actions always run on the server; without JavaScript the form posts to
 * `/newsletter`, an on-demand page that runs the same action and renders the result.
 */
export default function NewsletterForm({
  source = 'page',
  compact = false,
  className,
}: NewsletterFormProps) {
  const id = useId();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      const { error: actionError } = await actions.newsletter.subscribe(
        new FormData(event.currentTarget),
      );
      if (actionError) {
        setError(
          isInputError(actionError)
            ? (actionError.fields.email?.[0] ?? 'Please enter a valid email address.')
            : actionError.message,
        );
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
      <Alert variant="success" className={cn(className)}>
        {SUBSCRIBED_MESSAGE}
      </Alert>
    );
  }

  return (
    <form
      method="POST"
      action={`/newsletter${actions.newsletter.subscribe.queryString}`}
      onSubmit={onSubmit}
      aria-label="Subscribe to the newsletter"
      className={cn('space-y-2', className)}
    >
      <input type="hidden" name="source" value={source} />
      <div className={cn('flex gap-2', compact ? 'flex-row' : 'flex-col sm:flex-row')}>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-email`} className="sr-only">
            Email address
          </Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <Button type="submit" loading={status === 'sending'} className="shrink-0">
          Subscribe
        </Button>
      </div>
      {/* Honeypot: moved off-screen rather than display:none, which simple bots skip. */}
      <div
        className="absolute top-auto -left-[10000px] h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
