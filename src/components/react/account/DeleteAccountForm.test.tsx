// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const deleteUser = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    deleteUser: (...args: unknown[]) =>
      connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : deleteUser(...args),
  },
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import DeleteAccountForm from './DeleteAccountForm';

describe('<DeleteAccountForm>', () => {
  beforeEach(() => {
    deleteUser.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  it('opens on request, asks for the password and the confirmation word, then deletes', async () => {
    deleteUser.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<DeleteAccountForm hasPassword />);
    expect(screen.queryByRole('form', { name: 'Delete account' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'my-passphrase-2026');
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Permanently delete account' }));

    await waitFor(() =>
      expect(deleteUser).toHaveBeenCalledWith({
        password: 'my-passphrase-2026',
        callbackURL: '/account-deleted',
      }),
    );
    expect(window.location.assign).toHaveBeenCalledWith('/account-deleted');
    expect(trackEvent).toHaveBeenCalledWith('Account deleted');
  });

  it('refuses a wrong confirmation word without calling the server', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm hasPassword />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'my-passphrase-2026');
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await user.click(screen.getByRole('button', { name: 'Permanently delete account' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Type DELETE to confirm.');
    expect(deleteUser).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('skips the password for accounts without one and can be cancelled', async () => {
    deleteUser.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<DeleteAccountForm hasPassword={false} />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.queryByLabelText('Current password')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'Delete account' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Permanently delete account' }));
    await waitFor(() =>
      expect(deleteUser).toHaveBeenCalledWith({ callbackURL: '/account-deleted' }),
    );
  });

  it('shows the server error and stays on the page', async () => {
    deleteUser.mockResolvedValue({ data: null, error: { message: 'Session is not fresh' } });
    const user = userEvent.setup();
    render(<DeleteAccountForm hasPassword={false} />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Permanently delete account' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Session is not fresh'),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('explains a dropped connection and keeps the account', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<DeleteAccountForm hasPassword />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.type(screen.getByLabelText('Current password'), 'my-passphrase-2026');
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(screen.getByRole('button', { name: 'Permanently delete account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Permanently delete account' })).toBeEnabled();
  });
});
