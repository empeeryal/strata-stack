// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const magicLink = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      magicLink: (...args: unknown[]) =>
        connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : magicLink(...args),
    },
  },
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import MagicLinkForm from './MagicLinkForm';

describe('<MagicLinkForm>', () => {
  beforeEach(() => {
    magicLink.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
  });

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
    expect(trackEvent).toHaveBeenCalledWith('Magic link requested');
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

  it('explains a dropped connection and records nothing', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<MagicLinkForm />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
