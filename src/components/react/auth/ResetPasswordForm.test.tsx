// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resetPassword = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: { resetPassword: (...args: unknown[]) => resetPassword(...args) },
}));

import ResetPasswordForm from './ResetPasswordForm';

async function submit(user: ReturnType<typeof userEvent.setup>, confirm = 'new-passphrase-2026') {
  await user.type(screen.getByLabelText('New password'), 'new-passphrase-2026');
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Update password' }));
}

describe('<ResetPasswordForm>', () => {
  beforeEach(() => resetPassword.mockReset());

  it('sets the new password with the token from the link', async () => {
    resetPassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok-123" />);
    await submit(user);
    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: 'new-passphrase-2026',
        token: 'tok-123',
      }),
    );
    expect(screen.getByText(/Your password has been updated/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('refuses mismatched passwords locally', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok-123" />);
    await submit(user, 'different-passphrase');
    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.');
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows an expired token as the server describes it', async () => {
    resetPassword.mockResolvedValue({ data: null, error: { message: 'Invalid token' } });
    const user = userEvent.setup();
    render(<ResetPasswordForm token="stale" />);
    await submit(user);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid token'));
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
  });
});
