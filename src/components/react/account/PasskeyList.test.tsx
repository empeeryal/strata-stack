// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addPasskey = vi.fn();
const updatePasskey = vi.fn();
const deletePasskey = vi.fn();
// Set to make the mocked client fail the way a dropped connection does: the promise rejects from
// a plain function rather than from the vi.fn, which Vitest can otherwise count as a test error
// even though the component catches it.
let connectionLost = false;
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    passkey: {
      addPasskey: (...args: unknown[]) =>
        connectionLost ? Promise.reject(new TypeError('Failed to fetch')) : addPasskey(...args),
      updatePasskey: (...args: unknown[]) => updatePasskey(...args),
      deletePasskey: (...args: unknown[]) => deletePasskey(...args),
    },
  },
}));
const trackEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

import type { PasskeyItem } from '@/lib/passkeys';

import { UNEXPECTED_ERROR } from '../primitives';

import PasskeyList from './PasskeyList';

const passkeys: PasskeyItem[] = [
  {
    id: 'pk1',
    name: 'Work laptop',
    label: 'Work laptop',
    synced: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    createdLabel: 'Oct 1, 2026',
  },
  {
    id: 'pk2',
    name: null,
    label: '1Password',
    synced: true,
    createdAt: null,
    createdLabel: null,
  },
];

describe('<PasskeyList>', () => {
  beforeEach(() => {
    for (const fn of [addPasskey, updatePasskey, deletePasskey, trackEvent]) fn.mockReset();
    connectionLost = false;
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: {},
      writable: true,
      configurable: true,
    });
    vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });

  it('lists the passkeys with their labels, sync state and date', () => {
    render(<PasskeyList passkeys={passkeys} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Work laptop')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Oct 1, 2026')).toBeInTheDocument();
    expect(within(items[0]!).queryByText('Synced')).toBeNull();
    expect(within(items[1]!).getByText('1Password')).toBeInTheDocument();
    expect(within(items[1]!).getByText('Synced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a passkey' })).toBeInTheDocument();
  });

  it('creates a passkey, names it afterwards and reloads with a notice', async () => {
    addPasskey.mockResolvedValue({ data: { id: 'pk3', name: null }, error: null });
    updatePasskey.mockResolvedValue({ data: { passkey: { id: 'pk3' } }, error: null });
    const user = userEvent.setup();
    render(<PasskeyList passkeys={[]} />);
    expect(screen.getByText(/No passkeys yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    await user.type(screen.getByLabelText('Name (optional)'), 'Phone');
    await user.click(screen.getByRole('button', { name: 'Create passkey' }));

    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=passkey-added'),
    );
    // The name is not passed to the registration: it would become the account name the
    // authenticator shows. It is applied once the passkey exists.
    expect(addPasskey).toHaveBeenCalledWith();
    expect(updatePasskey).toHaveBeenCalledWith({ id: 'pk3', name: 'Phone' });
    expect(trackEvent).toHaveBeenCalledWith('Passkey added');
  });

  it('explains a registration the browser refused and keeps the form open', async () => {
    addPasskey.mockResolvedValue({
      data: null,
      error: { code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', status: 400, message: 'x' },
    });
    const user = userEvent.setup();
    render(<PasskeyList passkeys={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    await user.click(screen.getByRole('button', { name: 'Create passkey' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('already holds a passkey'),
    );
    expect(screen.getByRole('button', { name: 'Create passkey' })).toBeEnabled();
    expect(updatePasskey).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('renames a passkey in place', async () => {
    updatePasskey.mockResolvedValue({ data: { passkey: { id: 'pk2' } }, error: null });
    const user = userEvent.setup();
    render(<PasskeyList passkeys={passkeys} />);
    await user.click(screen.getByRole('button', { name: 'Rename 1Password' }));
    const form = screen.getByRole('form', { name: 'Rename 1Password' });
    await user.type(within(form).getByLabelText('New name'), 'Vault');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updatePasskey).toHaveBeenCalledWith({ id: 'pk2', name: 'Vault' }));
    expect(await screen.findByText('Vault')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Passkey renamed.');
    expect(screen.queryByText('1Password')).toBeNull();
  });

  it('asks before removing and reloads with a notice', async () => {
    deletePasskey.mockResolvedValue({ data: { status: true }, error: null });
    const user = userEvent.setup();
    render(<PasskeyList passkeys={passkeys} />);
    await user.click(screen.getByRole('button', { name: 'Remove Work laptop' }));
    const group = screen.getByRole('group', { name: 'Remove Work laptop' });
    expect(group).toHaveTextContent('no longer sign in with it');
    await user.click(within(group).getByRole('button', { name: 'Remove passkey' }));
    await waitFor(() => expect(deletePasskey).toHaveBeenCalledWith({ id: 'pk1' }));
    expect(window.location.assign).toHaveBeenCalledWith('/dashboard?notice=passkey-removed');
    expect(trackEvent).toHaveBeenCalledWith('Passkey removed');
  });

  it('shows the server error when removing fails and cancelling closes the prompt', async () => {
    deletePasskey.mockResolvedValue({ data: null, error: { message: 'Passkey not found' } });
    const user = userEvent.setup();
    render(<PasskeyList passkeys={passkeys} />);
    await user.click(screen.getByRole('button', { name: 'Remove Work laptop' }));
    await user.click(screen.getByRole('button', { name: 'Remove passkey' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Passkey not found'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group')).toBeNull();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('explains when the browser cannot create passkeys but still lists them', async () => {
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
    render(<PasskeyList passkeys={passkeys} />);
    await waitFor(() => expect(screen.getByText(/does not support passkeys/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Add a passkey' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Work laptop' })).toBeInTheDocument();
  });

  it('explains a dropped connection and keeps the add form open', async () => {
    connectionLost = true;
    const user = userEvent.setup();
    render(<PasskeyList passkeys={[]} />);
    await user.click(screen.getByRole('button', { name: 'Add a passkey' }));
    await user.click(screen.getByRole('button', { name: 'Create passkey' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(UNEXPECTED_ERROR));
    expect(screen.getByRole('button', { name: 'Create passkey' })).toBeEnabled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
