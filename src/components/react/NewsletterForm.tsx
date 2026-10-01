import { actions, isInputError } from 'astro:actions';
import { type SubmitEvent, useId, useState } from 'react';

import { ui } from '@/i18n/ui';
import { trackEvent } from '@/lib/analytics';
import type { NewsletterSource } from '@/lib/newsletter';
import { cn } from '@/lib/utils';

import { Alert, Button, Input, Label, UNEXPECTED_ERROR } from './primitives';

export interface NewsletterFormLabels {
  email: string;
  placeholder: string;
  submit: string;
  formLabel: string;
  sent: string;
  invalidEmail: string;
}

export interface NewsletterFormProps {
  /** Where the form is placed; stored with the subscription for the owner's information. */
  source?: NewsletterSource;
  /** Single row of input and button, for the footer. The default stacks them on small screens. */
  compact?: boolean;
  /** Extra classes for the form element. */
  className?: string | undefined;
  /** Strings for another locale; English by default (src/i18n/ui.ts). */
  labels?: Partial<NewsletterFormLabels> | undefined;
}

/** Shown after a successful request whatever the outcome, so the form reveals nothing. */
export const SUBSCRIBED_MESSAGE = ui.en['newsletter.sent'];

const DEFAULT_LABELS: NewsletterFormLabels = {
  email: ui.en['newsletter.email'],
  placeholder: ui.en['newsletter.placeholder'],
  submit: ui.en['newsletter.submit'],
  formLabel: ui.en['newsletter.formLabel'],
  sent: SUBSCRIBED_MESSAGE,
  invalidEmail: ui.en['newsletter.invalidEmail'],
};

/**
 * Newsletter sign-up submitted through the `newsletter.subscribe` action. Works from static
 * pages because actions always run on the server; without JavaScript the form posts to
 * `/newsletter`, an on-demand page that runs the same action and renders the result.
 */
export default function NewsletterForm({
  source = 'page',
  compact = false,
  className,
  labels,
}: NewsletterFormProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
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
            ? (actionError.fields.email?.[0] ?? text.invalidEmail)
            : actionError.message,
        );
        setStatus('idle');
        return;
      }
      setStatus('sent');
      trackEvent('Newsletter subscribed', { source });
    } catch {
      setError(UNEXPECTED_ERROR);
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <Alert variant="success" className={cn(className)}>
        {text.sent}
      </Alert>
    );
  }

  return (
    <form
      method="POST"
      action={`/newsletter${actions.newsletter.subscribe.queryString}`}
      onSubmit={onSubmit}
      aria-label={text.formLabel}
      className={cn('space-y-2', className)}
    >
      <input type="hidden" name="source" value={source} />
      <div className={cn('flex gap-2', compact ? 'flex-row' : 'flex-col sm:flex-row')}>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-email`} className="sr-only">
            {text.email}
          </Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={text.placeholder}
            required
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        <Button type="submit" loading={status === 'sending'} className="shrink-0">
          {text.submit}
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
