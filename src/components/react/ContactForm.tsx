import { actions, isInputError } from 'astro:actions';
import { type SubmitEvent, useState } from 'react';

import { Alert, Button, Field, Input, Label, Textarea, UNEXPECTED_ERROR } from './primitives';

/**
 * Contact form submitted through the `contact` Astro Action. Works from static pages
 * because actions are always handled by the server.
 */
export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setStatus('sending');

    try {
      const { error: actionError } = await actions.contact(new FormData(event.currentTarget));
      if (actionError) {
        if (isInputError(actionError)) {
          setFieldErrors(actionError.fields);
          setError('Please fix the highlighted fields.');
        } else {
          setError(actionError.message);
        }
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
      <Alert variant="success">
        Thanks, your message has been received. We read every message and reply by email when a
        response is needed.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field>
        <Label htmlFor="contact-name">Name</Label>
        <Input
          id="contact-name"
          name="name"
          autoComplete="name"
          required
          minLength={2}
          aria-invalid={Boolean(fieldErrors.name) || undefined}
          aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined}
        />
        {fieldErrors.name && (
          <p id="contact-name-error" className="text-xs text-danger">
            {fieldErrors.name[0]}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldErrors.email) || undefined}
          aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
        />
        {fieldErrors.email && (
          <p id="contact-email-error" className="text-xs text-danger">
            {fieldErrors.email[0]}
          </p>
        )}
      </Field>
      <Field>
        <Label htmlFor="contact-message">Message</Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          aria-invalid={Boolean(fieldErrors.message) || undefined}
          aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined}
        />
        {fieldErrors.message && (
          <p id="contact-message-error" className="text-xs text-danger">
            {fieldErrors.message[0]}
          </p>
        )}
      </Field>
      {/* Honeypot: moved off-screen rather than display:none, which simple bots skip. */}
      <div
        className="absolute top-auto -left-[10000px] h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" loading={status === 'sending'}>
        Send message
      </Button>
    </form>
  );
}
