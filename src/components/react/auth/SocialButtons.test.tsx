// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const social = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) =>
        connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : social(...args),
    },
  },
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import SocialButtons from './SocialButtons';

describe('<SocialButtons>', () => {
  beforeEach(() => {
    social.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
  });

  it('renders nothing without configured providers', () => {
    const { container } = render(<SocialButtons providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('starts the provider flow for the clicked button and keeps it busy', async () => {
    social.mockResolvedValue({ data: { url: 'https://github.com/login' }, error: null });
    const user = userEvent.setup();
    render(<SocialButtons providers={['github', 'google']} redirectTo="/admin" />);
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    await waitFor(() =>
      expect(social).toHaveBeenCalledWith({ provider: 'github', callbackURL: '/admin' }),
    );
    // The browser is about to leave for the provider; the button stays busy.
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(trackEvent).toHaveBeenCalledWith('Social sign-in started', { provider: 'github' });
  });

  it('shows the error and releases the button when the provider refuses', async () => {
    social.mockResolvedValue({ data: null, error: { message: 'Provider not configured' } });
    const user = userEvent.setup();
    render(<SocialButtons providers={['google']} />);
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Provider not configured'),
    );
    expect(social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/dashboard' });
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });

  it('explains a dropped connection and releases the button', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<SocialButtons providers={['github']} />);
    await user.click(screen.getByRole('button', { name: 'Continue with GitHub' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeEnabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
