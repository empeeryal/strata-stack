// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const changePassword = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    changePassword: (...args: unknown[]) =>
      connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : changePassword(...args),
  },
}));

import { UNEXPECTED_ERROR } from '../primitives';

import ChangePasswordForm from './ChangePasswordForm';

async function fill(user: ReturnType<typeof userEvent.setup>, confirm = 'new-passphrase-2026') {
  await user.type(screen.getByLabelText('Current password'), 'old-passphrase-2025');
  await user.type(screen.getByLabelText('New password'), 'new-passphrase-2026');
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Update password' }));
}

describe('<ChangePasswordForm>', () => {
  beforeEach(() => {
    changePassword.mockReset();
    connectionLost = false;
  });

  it('changes the password, signs out other sessions and clears the form', async () => {
    changePassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await fill(user);
    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'old-passphrase-2025',
        newPassword: 'new-passphrase-2026',
        revokeOtherSessions: true,
      }),
    );
    expect(
      screen.getByText('Password updated. Other sessions were signed out.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('refuses mismatched passwords before calling the server', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await fill(user, 'something-else-entirely');
    expect(screen.getByRole('alert')).toHaveTextContent('The new passwords do not match.');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('shows the server error', async () => {
    changePassword.mockResolvedValue({ data: null, error: { message: 'Invalid password' } });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await fill(user);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid password'));
    expect(screen.queryByText(/Password updated/)).toBeNull();
  });

  it('explains a dropped connection and keeps the form', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await fill(user);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.queryByText(/Password updated/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
  });
});
