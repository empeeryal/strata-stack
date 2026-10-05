// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAuth = vi.fn();
const getSession = vi.fn();
// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    $fetch: (...args: unknown[]) =>
      connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : fetchAuth(...args),
    getSession: (...args: unknown[]) => getSession(...args),
  },
}));
const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import { UNEXPECTED_ERROR } from '../primitives';

import ChangeEmailForm from './ChangeEmailForm';

describe('<ChangeEmailForm>', () => {
  beforeEach(() => {
    fetchAuth.mockReset();
    getSession.mockReset();
    trackEvent.mockReset();
    connectionLost = false;
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  it('sends the new address with the password and explains the two links', async () => {
    fetchAuth.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword mode="confirm" />);
    await user.type(screen.getByLabelText('New email address'), ' Ada.New@Example.com ');
    await user.type(screen.getByLabelText('Current password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));

    await waitFor(() =>
      expect(fetchAuth).toHaveBeenCalledWith('/change-email', {
        method: 'POST',
        body: {
          newEmail: 'ada.new@example.com',
          callbackURL: '/dashboard?notice=email-change',
          password: 'correct-horse-battery',
        },
      }),
    );
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('Check the inbox of ada@example.com first');
    expect(notice).toHaveTextContent('ada.new@example.com');
    expect(trackEvent).toHaveBeenCalledWith('Email change requested');
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('omits the password for accounts without one and points at the new inbox', async () => {
    fetchAuth.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword={false} mode="verify" />);
    expect(screen.queryByLabelText('Current password')).toBeNull();
    await user.type(screen.getByLabelText('New email address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    await waitFor(() =>
      expect(fetchAuth).toHaveBeenCalledWith('/change-email', {
        method: 'POST',
        body: { newEmail: 'new@example.com', callbackURL: '/dashboard?notice=email-change' },
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Check the inbox of new@example.com',
    );
  });

  it('reloads with a notice when the address changed right away', async () => {
    fetchAuth.mockResolvedValue({ data: { status: true }, error: null });
    getSession.mockResolvedValue({ data: { user: { email: 'new@example.com' } }, error: null });
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword mode="immediate" />);
    await user.type(screen.getByLabelText('New email address'), 'new@example.com');
    await user.type(screen.getByLabelText('Current password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=email-updated'),
    );
  });

  it('reports an address the account could not take', async () => {
    fetchAuth.mockResolvedValue({ data: { status: true }, error: null });
    getSession.mockResolvedValue({ data: { user: { email: 'ada@example.com' } }, error: null });
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword={false} mode="immediate" />);
    await user.type(screen.getByLabelText('New email address'), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('cannot be used'));
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('refuses the current address locally and shows server errors', async () => {
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword mode="confirm" />);
    await user.type(screen.getByLabelText('New email address'), 'ADA@example.com');
    await user.type(screen.getByLabelText('Current password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    expect(screen.getByRole('alert')).toHaveTextContent('already the address');
    expect(fetchAuth).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New email address')).toHaveAttribute('aria-invalid', 'true');

    fetchAuth.mockResolvedValue({ data: null, error: { message: 'Invalid password' } });
    await user.clear(screen.getByLabelText('New email address'));
    await user.type(screen.getByLabelText('New email address'), 'other@example.com');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid password'));
    expect(trackEvent).not.toHaveBeenCalled();
    // The error is read with the field it is about.
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('New email address')).not.toHaveAttribute('aria-invalid');
  });

  it('explains when the change is unavailable', () => {
    render(<ChangeEmailForm email="ada@example.com" hasPassword mode="unavailable" />);
    expect(screen.getByText(/needs email delivery/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('explains a dropped connection and keeps the form', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<ChangeEmailForm email="ada@example.com" hasPassword={false} mode="verify" />);
    await user.type(screen.getByLabelText('New email address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Change email address' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByRole('button', { name: 'Change email address' })).toBeEnabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
