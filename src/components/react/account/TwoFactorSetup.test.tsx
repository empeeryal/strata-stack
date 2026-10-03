// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enable = vi.fn();
const verifyTotp = vi.fn();
const generateBackupCodes = vi.fn();
const disable = vi.fn();

// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    twoFactor: {
      enable: (...a: unknown[]) =>
        connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : enable(...a),
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      generateBackupCodes: (...a: unknown[]) => generateBackupCodes(...a),
      disable: (...a: unknown[]) => disable(...a),
    },
  },
}));
vi.mock('qrcode', () => ({ toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') }));

import { UNEXPECTED_ERROR } from '../primitives';

import TwoFactorSetup from './TwoFactorSetup';

const codes = ['aaaa-1111', 'bbbb-2222', 'cccc-3333'];
const totpURI = 'otpauth://totp/Strata:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Strata';

describe('<TwoFactorSetup>', () => {
  beforeEach(() => {
    for (const fn of [enable, verifyTotp, generateBackupCodes, disable]) fn.mockReset();
    connectionLost = false;
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it('walks through password, QR code, first code and backup codes, then reloads', async () => {
    enable.mockResolvedValue({
      data: { method: 'totp', totpURI, backupCodes: codes },
      error: null,
    });
    verifyTotp.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<TwoFactorSetup enabled={false} hasPassword />);

    expect(screen.getByText('Off')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(enable).toHaveBeenCalledWith({ password: 'correct-horse-battery' }));
    const image = await screen.findByRole('img', { name: 'QR code for your authenticator app' });
    expect(image).toHaveAttribute('src', 'data:image/png;base64,QR');
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code from the app'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(verifyTotp).toHaveBeenCalledWith({ code: '123456' }));
    for (const code of codes) expect(await screen.findByText(code)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=two-factor-enabled');
  });

  it('explains a wrong first code and keeps the setup open', async () => {
    enable.mockResolvedValue({
      data: { method: 'totp', totpURI, backupCodes: codes },
      error: null,
    });
    verifyTotp.mockResolvedValue({ data: null, error: { status: 401, message: 'INVALID_CODE' } });
    const user = userEvent.setup();
    render(<TwoFactorSetup enabled={false} hasPassword />);
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(screen.getByLabelText('Current password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText('Code from the app'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('did not match'));
    expect(screen.getByLabelText('Code from the app')).toBeInTheDocument();
  });

  it('regenerates backup codes and turns two-factor off with the password', async () => {
    generateBackupCodes.mockResolvedValue({ data: { backupCodes: ['new-1'] }, error: null });
    disable.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<TwoFactorSetup enabled hasPassword />);

    expect(screen.getByText('On')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Regenerate backup codes' }));
    await user.type(screen.getByLabelText('Current password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByText('new-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(window.location.assign).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    await user.type(screen.getByLabelText('Current password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(disable).toHaveBeenCalledWith({ password: 'pw' }));
    expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=two-factor-disabled');
  });

  it('explains why accounts without a password cannot turn it on', () => {
    render(<TwoFactorSetup enabled={false} hasPassword={false} />);
    expect(screen.getByText(/needs a password/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('explains a dropped connection and keeps the password step open', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<TwoFactorSetup enabled={false} hasPassword />);
    await user.click(screen.getByRole('button', { name: 'Turn on two-factor authentication' }));
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
