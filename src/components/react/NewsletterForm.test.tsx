// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribe = vi.fn();

vi.mock('astro:actions', () => ({
  actions: {
    newsletter: {
      subscribe: Object.assign((...args: unknown[]) => subscribe(...args), {
        queryString: '?_action=newsletter.subscribe',
      }),
    },
  },
  isInputError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'fields' in error),
}));

import NewsletterForm, { SUBSCRIBED_MESSAGE } from './NewsletterForm';

async function submit(email = 'reader@example.com') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), email);
  await user.click(screen.getByRole('button', { name: 'Subscribe' }));
}

describe('<NewsletterForm>', () => {
  beforeEach(() => subscribe.mockReset());

  it('posts to the newsletter page without JavaScript and carries the source', () => {
    render(<NewsletterForm source="footer" />);
    const form = screen.getByRole('form', { name: 'Subscribe to the newsletter' });
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('action', '/newsletter?_action=newsletter.subscribe');
    expect(form.querySelector('input[name="source"]')).toHaveValue('footer');
    // The honeypot is present but out of the accessibility tree.
    const honeypot = form.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the same confirmation message for every successful outcome', async () => {
    subscribe.mockResolvedValue({ data: { ok: true, outcome: 'already-subscribed' } });
    render(<NewsletterForm />);
    await submit();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(SUBSCRIBED_MESSAGE));
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('renders the field error returned by the action', async () => {
    subscribe.mockResolvedValue({
      data: undefined,
      error: { fields: { email: ['Please enter a valid email address.'] } },
    });
    render(<NewsletterForm />);
    await submit();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.'),
    );
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders other action errors and keeps the form', async () => {
    subscribe.mockResolvedValue({
      data: undefined,
      error: { message: 'Too many requests from this sender. Please try again in a little while.' },
    });
    render(<NewsletterForm />);
    await submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests'));
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });
});
