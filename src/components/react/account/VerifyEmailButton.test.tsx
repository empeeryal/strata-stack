// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendVerificationEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: { sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args) },
}));

import VerifyEmailButton from './VerifyEmailButton';

describe('<VerifyEmailButton>', () => {
  beforeEach(() => sendVerificationEmail.mockReset());

  it('sends the verification email for the address and confirms it', async () => {
    sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<VerifyEmailButton email="ada@example.com" />);
    await user.click(screen.getByRole('button', { name: 'Send verification email' }));
    await waitFor(() =>
      expect(sendVerificationEmail).toHaveBeenCalledWith({
        email: 'ada@example.com',
        callbackURL: '/dashboard',
      }),
    );
    expect(screen.getByText(/Verification email sent/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps the button and shows the error when sending fails', async () => {
    sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { message: 'Too many requests' },
    });
    const user = userEvent.setup();
    render(<VerifyEmailButton email="ada@example.com" />);
    await user.click(screen.getByRole('button', { name: 'Send verification email' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests'));
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeEnabled();
  });
});
