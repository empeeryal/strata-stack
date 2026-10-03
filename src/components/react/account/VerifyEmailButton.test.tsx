// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
const sendVerificationEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    sendVerificationEmail: (...args: unknown[]) =>
      connectionLost
        ? Promise.reject(new TypeError('Failed to fetch'))
        : sendVerificationEmail(...args),
  },
}));

import { UNEXPECTED_ERROR } from '../primitives';

import VerifyEmailButton from './VerifyEmailButton';

describe('<VerifyEmailButton>', () => {
  beforeEach(() => {
    sendVerificationEmail.mockReset();
    connectionLost = false;
  });

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

  it('explains a dropped connection and keeps the button', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<VerifyEmailButton email="ada@example.com" />);
    await user.click(screen.getByRole('button', { name: 'Send verification email' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeEnabled();
  });
});
