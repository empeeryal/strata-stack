// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyTotp = vi.fn();
const verifyBackupCode = vi.fn();

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      verifyTotp: (...a: unknown[]) =>
        connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : verifyTotp(...a),
      verifyBackupCode: (...a: unknown[]) => verifyBackupCode(...a),
    },
  },
}));

const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import TwoFactorForm, { CHALLENGE_OVER_MESSAGE } from './TwoFactorForm';

describe('<TwoFactorForm>', () => {
  beforeEach(() => {
    verifyTotp.mockReset();
    verifyBackupCode.mockReset();
    connectionLost = false;
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it('verifies an authenticator code, honouring the trusted-device choice', async () => {
    verifyTotp.mockResolvedValue({ data: { token: 't' }, error: null });
    const user = userEvent.setup();
    render(<TwoFactorForm redirectTo="/admin" />);
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByLabelText('Trust this device for 30 days'));
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(verifyTotp).toHaveBeenCalledWith({ code: '123456', trustDevice: true }),
    );
    expect(window.location.assign).toHaveBeenCalledWith('/admin');
    expect(trackEvent).toHaveBeenCalledWith('Signed in', { method: 'password', twoFactor: true });
  });

  it('switches to a backup code and explains a used one', async () => {
    verifyBackupCode.mockResolvedValue({ data: null, error: { status: 401, message: 'INVALID' } });
    const user = userEvent.setup();
    render(<TwoFactorForm redirectTo="/dashboard" />);
    await user.click(screen.getByRole('button', { name: 'Use a backup code instead' }));
    await user.type(screen.getByLabelText('Backup code'), 'aaaa-1111');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(verifyBackupCode).toHaveBeenCalledWith({ code: 'aaaa-1111', trustDevice: false }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('did not match or was already used');
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('sends the visitor back to the password step once the attempt is used up', async () => {
    verifyTotp.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        code: 'INVALID_TWO_FACTOR_COOKIE',
        message: 'Invalid two factor cookie',
      },
    });
    const user = userEvent.setup();
    render(<TwoFactorForm redirectTo="/dashboard" />);
    await user.type(screen.getByLabelText('Authenticator code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(CHALLENGE_OVER_MESSAGE),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('explains a dropped connection without ending the attempt', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<TwoFactorForm redirectTo="/dashboard" />);
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
  });
});
