// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInPasskey = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { passkey: (...args: unknown[]) => signInPasskey(...args) } },
}));
const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import PasskeyButton, { describePasskeyError } from './PasskeyButton';

/** A never-settling promise stands in for the autofill request waiting for a pick. */
const pending = () => new Promise<never>(() => {});

describe('<PasskeyButton>', () => {
  const credential = { isConditionalMediationAvailable: vi.fn() };

  beforeEach(() => {
    signInPasskey.mockReset();
    trackEvent.mockReset();
    credential.isConditionalMediationAvailable.mockReset().mockResolvedValue(false);
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: credential,
      writable: true,
      configurable: true,
    });
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });

  it('signs in with a passkey and records the event', async () => {
    signInPasskey.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    const user = userEvent.setup();
    render(<PasskeyButton redirectTo="/admin" />);
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/admin'));
    expect(signInPasskey).toHaveBeenCalledWith();
    expect(trackEvent).toHaveBeenCalledWith('Signed in', { method: 'passkey', twoFactor: false });
  });

  it('explains a closed prompt and an unknown passkey without leaving the page', async () => {
    signInPasskey.mockResolvedValueOnce({
      data: null,
      error: { code: 'ERROR_CEREMONY_ABORTED', status: 400, message: 'aborted' },
    });
    const user = userEvent.setup();
    render(<PasskeyButton />);
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No passkey was used'));

    signInPasskey.mockResolvedValueOnce({
      data: null,
      error: { code: 'PASSKEY_NOT_FOUND', status: 401, message: 'Passkey not found' },
    });
    await user.click(screen.getByRole('button', { name: 'Sign in with a passkey' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('not registered here any more'),
    );
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('offers saved passkeys through autofill when the browser supports it', async () => {
    credential.isConditionalMediationAvailable.mockResolvedValue(true);
    signInPasskey.mockImplementation((options?: { autoFill?: boolean }) =>
      options?.autoFill
        ? Promise.resolve({ data: { session: {}, user: {} }, error: null })
        : pending(),
    );
    render(<PasskeyButton />);
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('/dashboard'));
    expect(signInPasskey).toHaveBeenCalledWith({ autoFill: true });
  });

  it('ignores a cancelled autofill request', async () => {
    credential.isConditionalMediationAvailable.mockResolvedValue(true);
    signInPasskey.mockResolvedValue({
      data: null,
      error: { code: 'AUTH_CANCELLED', status: 400, message: 'cancelled' },
    });
    render(<PasskeyButton />);
    await waitFor(() => expect(signInPasskey).toHaveBeenCalledWith({ autoFill: true }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('renders nothing in a browser without WebAuthn', async () => {
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
    render(<PasskeyButton />);
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(signInPasskey).not.toHaveBeenCalled();
  });
});

describe('describePasskeyError', () => {
  it('falls back to the server message', () => {
    expect(describePasskeyError({ status: 429, message: 'Too many requests' })).toBe(
      'Too many requests',
    );
    expect(describePasskeyError({ status: 500 })).toMatch(/Something went wrong/);
  });
});
