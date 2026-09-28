// @vitest-environment happy-dom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const revokeSession = vi.fn();
const revokeOtherSessions = vi.fn();

vi.mock('astro:actions', () => ({
  actions: {
    account: {
      revokeSession: Object.assign((...args: unknown[]) => revokeSession(...args), {
        queryString: '?_action=account.revokeSession',
      }),
      revokeOtherSessions: Object.assign((...args: unknown[]) => revokeOtherSessions(...args), {
        queryString: '?_action=account.revokeOtherSessions',
      }),
    },
  },
}));

import SessionList, { type SessionItem } from './SessionList';

const session = (id: string, current = false): SessionItem => ({
  id,
  label: current ? 'Chrome on macOS' : `Firefox on Linux ${id}`,
  ipAddress: '203.0.113.7',
  createdAt: '2026-09-28T10:00:00.000Z',
  createdLabel: 'Sep 28, 2026, 10:00 AM',
  expiresAt: '2026-10-05T10:00:00.000Z',
  expiresLabel: 'Oct 5, 2026',
  current,
});

describe('<SessionList>', () => {
  beforeEach(() => {
    revokeSession.mockReset();
    revokeOtherSessions.mockReset();
  });

  it('renders the sessions as forms that post to the actions without JavaScript', () => {
    render(<SessionList sessions={[session('me', true), session('other')]} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('This device')).toBeInTheDocument();
    expect(within(items[0]!).queryByRole('button', { name: 'Sign out' })).toBeNull();
    const form = within(items[1]!).getByRole('button', { name: 'Sign out' }).closest('form');
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('action', '?_action=account.revokeSession');
    expect(form?.querySelector('input[name="id"]')).toHaveValue('other');
    expect(
      screen.getByRole('button', { name: 'Sign out of other sessions' }).closest('form'),
    ).toHaveAttribute('action', '?_action=account.revokeOtherSessions');
  });

  it('signs out one session in place', async () => {
    revokeSession.mockResolvedValue({ data: { notice: 'session-revoked' }, error: undefined });
    const user = userEvent.setup();
    render(<SessionList sessions={[session('me', true), session('a'), session('b')]} />);
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(revokeSession).toHaveBeenCalledTimes(1);
    const sent = revokeSession.mock.calls[0]?.[0] as FormData;
    expect(sent.get('id')).toBe('a');
    expect(screen.getByRole('status')).toHaveTextContent('That session was signed out.');
    expect(screen.getByRole('button', { name: 'Sign out of other sessions' })).toBeInTheDocument();
  });

  it('signs out every other session and hides the button', async () => {
    revokeOtherSessions.mockResolvedValue({
      data: { notice: 'sessions-revoked' },
      error: undefined,
    });
    const user = userEvent.setup();
    render(<SessionList sessions={[session('me', true), session('a'), session('b')]} />);
    await user.click(screen.getByRole('button', { name: 'Sign out of other sessions' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out of other sessions' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Every other session was signed out.');
  });

  it('keeps the list and shows the message when the action fails', async () => {
    revokeSession.mockResolvedValue({
      data: undefined,
      error: { message: 'That session no longer exists.' },
    });
    const user = userEvent.setup();
    render(<SessionList sessions={[session('me', true), session('a')]} />);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('no longer exists'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
