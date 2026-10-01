// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInEmail = vi.fn();
const signUpEmail = vi.fn();
const sendVerificationEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
    sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
  },
}));

import { UNEXPECTED_ERROR } from '../primitives';

import AuthForm from './AuthForm';

const PASSWORD = 'correct-horse-battery';

describe('<AuthForm>', () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signUpEmail.mockReset();
    sendVerificationEmail.mockReset();
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  it('sends accounts with two-factor authentication to the second step', async () => {
    signInEmail.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="login" redirectTo="/admin" />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('/two-factor?next=%2Fadmin'),
    );
  });

  it('signs in with email and password and redirects', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="login" redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(1));
    expect(signInEmail.mock.calls[0]?.[0]).toMatchObject({
      email: 'ada@example.com',
      callbackURL: '/dashboard',
    });
    expect(window.location.assign).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the name field in signup mode and surfaces errors', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { message: 'Email already in use' } });
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already in use'),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('offers to resend the verification email when the address is unverified', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { status: 403, message: 'Not verified' } });
    sendVerificationEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Verify your email address'),
    );

    await user.click(screen.getByRole('button', { name: 'Resend the verification email' }));
    await waitFor(() =>
      expect(sendVerificationEmail).toHaveBeenCalledWith({
        email: 'ada@example.com',
        callbackURL: '/dashboard',
      }),
    );
    expect(screen.getByText(/Verification email sent/)).toBeInTheDocument();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('tells a new account to verify its address when no session comes back', async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: {} }, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);
    // The rules are stated before anyone types.
    expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Ada');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByText(/Check your inbox/)).toBeInTheDocument());
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('only links to the password reset when email delivery is configured', () => {
    const { unmount } = render(<AuthForm mode="login" passwordReset />);
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    unmount();
    render(<AuthForm mode="login" />);
    expect(screen.queryByRole('link', { name: 'Forgot password?' })).toBeNull();
  });

  it('shows a generic message when the request itself fails', async () => {
    signInEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
  });
});
