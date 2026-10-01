// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const magicLink = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { magicLink: (...args: unknown[]) => magicLink(...args) } },
}));

import MagicLinkForm from './MagicLinkForm';

describe('<MagicLinkForm>', () => {
  beforeEach(() => magicLink.mockReset());

  it('asks for a sign-in link to the given destination', async () => {
    magicLink.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<MagicLinkForm redirectTo="/admin" />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await waitFor(() =>
      expect(magicLink).toHaveBeenCalledWith({ email: 'ada@example.com', callbackURL: '/admin' }),
    );
    expect(screen.getByText(/a sign-in link is on its way/)).toBeInTheDocument();
  });

  it('defaults to the dashboard and explains a failed send', async () => {
    magicLink.mockResolvedValue({ data: null, error: { status: 500 } });
    const user = userEvent.setup();
    render(<MagicLinkForm />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await waitFor(() =>
      expect(magicLink).toHaveBeenCalledWith({
        email: 'ada@example.com',
        callbackURL: '/dashboard',
      }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The link could not be sent. Try again.');
  });
});
