// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPasswordReset = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: { requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args) },
}));

import ForgotPasswordForm from './ForgotPasswordForm';

describe('<ForgotPasswordForm>', () => {
  beforeEach(() => requestPasswordReset.mockReset());

  it('requests a reset link and answers the same way for any address', async () => {
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText('Email'), '  ada@example.com ');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: 'ada@example.com',
        redirectTo: '/reset-password',
      }),
    );
    expect(screen.getByText(/If an account exists for that address/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the error and lets the visitor try again', async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: { message: 'Too many requests' } });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests'));
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });
});
