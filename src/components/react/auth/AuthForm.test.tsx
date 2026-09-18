// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInEmail = vi.fn();
const signUpEmail = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}));

import AuthForm from './AuthForm';

describe('<AuthForm>', () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signUpEmail.mockReset();
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  it('signs in with email and password and redirects', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<AuthForm mode="login" redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
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
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already in use'),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
