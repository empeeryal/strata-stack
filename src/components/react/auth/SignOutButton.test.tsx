// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const signOut = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signOut: (...args: unknown[]) =>
      connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : signOut(...args),
  },
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import SignOutButton from './SignOutButton';

describe('<SignOutButton>', () => {
  beforeEach(() => {
    signOut.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  it('signs out and goes to the requested page', async () => {
    signOut.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<SignOutButton redirectTo="/goodbye" />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/goodbye'));
    expect(trackEvent).toHaveBeenCalledWith('Signed out');
  });

  it('says so when the session could not be ended, instead of pretending', async () => {
    signOut.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network error'));
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });

  it('explains a dropped connection and stays signed in', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
