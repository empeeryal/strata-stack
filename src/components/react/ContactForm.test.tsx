// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const contact = vi.fn();

vi.mock('astro:actions', () => ({
  actions: { contact: (...args: unknown[]) => contact(...args) },
  isInputError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'fields' in error),
}));

import ContactForm from './ContactForm';

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Message'), 'Hello there, this is a message.');
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

describe('<ContactForm>', () => {
  beforeEach(() => contact.mockReset());

  it('shows a success message after submitting', async () => {
    contact.mockResolvedValue({ data: { ok: true }, error: undefined });
    render(<ContactForm />);
    await fillAndSubmit();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Thanks'));
    expect(contact).toHaveBeenCalledTimes(1);
    expect(contact.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
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
});
