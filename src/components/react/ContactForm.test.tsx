// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contact = vi.fn();

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
vi.mock('astro:actions', () => ({
  actions: {
    contact: (...args: unknown[]) =>
      connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : contact(...args),
  },
  isInputError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'fields' in error),
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from './primitives';

import ContactForm from './ContactForm';

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Message'), 'Hello there, this is a message.');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('<ContactForm>', () => {
  beforeEach(() => {
    contact.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
  });

  it('shows a success message after submitting', async () => {
    contact.mockResolvedValue({ data: { ok: true }, error: undefined });
    render(<ContactForm />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Thanks'));
    expect(contact).toHaveBeenCalledTimes(1);
    expect(contact.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(trackEvent).toHaveBeenCalledWith('Contact message sent');
  });

  it('renders field errors returned by the action', async () => {
    contact.mockResolvedValue({
      data: undefined,
      error: { fields: { email: ['Please enter a valid email address.'] } },
    });
    render(<ContactForm />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('explains a dropped connection and keeps the message in the form', async () => {
    connectionLost = true;
    render(<ContactForm />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByLabelText('Message')).toHaveValue('Hello there, this is a message.');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
