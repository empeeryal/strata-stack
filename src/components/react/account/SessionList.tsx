import { actions } from 'astro:actions';
import { type SubmitEvent, useState } from 'react';

import { Alert, Badge, Button, UNEXPECTED_ERROR } from '../primitives';

export interface SessionItem {
  id: string;
  /** "Chrome on macOS", from `describeUserAgent()`. */
  label: string;
  ipAddress: string | null;
  /** ISO timestamps and their display text, formatted on the server so both sides agree. */
  createdAt: string;
  createdLabel: string;
  expiresAt: string;
  expiresLabel: string;
  /** The session making the request; it is never offered for sign-out here. */
  current: boolean;
}

export interface SessionListProps {
  sessions: SessionItem[];
}

/**
 * The dashboard's session list. It renders the same forms the page posts without JavaScript
 * (`account.revokeSession` and `account.revokeOtherSessions`, which redirect with a notice)
 * and, once hydrated, submits them through the actions client and updates the list in place.
 */
export default function SessionList({ sessions: initial }: SessionListProps) {
  const [sessions, setSessions] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function revoke(event: SubmitEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setPending(id);
    try {
      const { error: actionError } = await actions.account.revokeSession(
        new FormData(event.currentTarget),
      );
      if (actionError) {
        setError(actionError.message);
        return;
      }
      setSessions((list) => list.filter((session) => session.id !== id));
      setStatus('That session was signed out.');
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setPending(null);
    }
  }

  async function revokeOthers(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setPending('others');
    try {
      const { error: actionError } = await actions.account.revokeOtherSessions(
        new FormData(event.currentTarget),
      );
      if (actionError) {
        setError(actionError.message);
        return;
      }
      setSessions((list) => list.filter((session) => session.current));
      setStatus('Every other session was signed out.');
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {error && <Alert className="mt-4">{error}</Alert>}
      {status && (
        <Alert variant="success" className="mt-4" data-sessions-status>
          {status}
        </Alert>
      )}
      <ul className="mt-4 divide-y text-sm" data-sessions>
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {session.label}
                {session.current && <Badge className="ml-2 align-middle">This device</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.ipAddress ? `${session.ipAddress} · ` : ''}
                Signed in <time dateTime={session.createdAt}>{session.createdLabel}</time>
                {' · '}Expires <time dateTime={session.expiresAt}>{session.expiresLabel}</time>
              </p>
            </div>
            {!session.current && (
              <form
                method="POST"
                action={actions.account.revokeSession.queryString}
                onSubmit={(event) => revoke(event, session.id)}
              >
                <input type="hidden" name="id" value={session.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  loading={pending === session.id}
                  disabled={pending !== null}
                >
                  Sign out
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <form
          method="POST"
          action={actions.account.revokeOtherSessions.queryString}
          onSubmit={revokeOthers}
          className="mt-3"
        >
          <Button
            type="submit"
            variant="outline"
            size="sm"
            loading={pending === 'others'}
            disabled={pending !== null}
          >
            Sign out of other sessions
          </Button>
        </form>
      )}
    </div>
  );
}
