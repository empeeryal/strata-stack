import { type SubmitEvent, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { authClient } from '@/lib/auth-client';
import type { PasskeyItem } from '@/lib/passkeys';

import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Label,
  UNEXPECTED_ERROR,
  useFocusOnChange,
  useWebAuthnSupport,
} from '../primitives';

// The cap src/lib/auth.ts enforces for the plugin's endpoints, repeated here because that module
// pulls in the server side of the passkey plugin.
const PASSKEY_NAME_MAX_LENGTH = 64;

export interface PasskeyListProps {
  passkeys: PasskeyItem[];
}

type Step = { kind: 'idle' } | { kind: 'add' } | { kind: 'rename' | 'remove'; id: string };

/** The browser's reasons for a registration that did not happen, in the user's words. */
function describeRegistrationError(error: {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}): string {
  switch (error.code) {
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return 'This device already holds a passkey for your account.';
    case 'ERROR_CEREMONY_ABORTED':
    case 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY':
    case 'AUTH_CANCELLED':
      return 'No passkey was created. Try again when you are ready.';
    case 'SESSION_NOT_FRESH':
      return 'Sign in again before adding a passkey: this session is older than a day.';
    default:
      return error.message ?? UNEXPECTED_ERROR;
  }
}

/**
 * The dashboard's passkeys: the ones on the account with the option to rename or remove each,
 * and a button that creates a new one through the browser's passkey prompt. Adding and removing
 * reload the page with a notice, because the account card's sign-in methods are server rendered;
 * renaming updates the list in place.
 */
export default function PasskeyList({ passkeys: initial }: PasskeyListProps) {
  const [passkeys, setPasskeys] = useState(initial);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const supported = useWebAuthnSupport();
  // Opening a form removes the button that opened it, closing it removes the form: the focus
  // follows into the form, and back to the button the person came from (`returnTo`).
  const container = useRef<HTMLDivElement>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useFocusOnChange(
    container,
    step.kind === 'idle' ? 'idle' : `${step.kind}:${'id' in step ? step.id : ''}`,
  );

  async function run(work: () => Promise<void>) {
    setError(null);
    setStatus(null);
    setLoading(true);
    try {
      await work();
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  async function add(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    await run(async () => {
      // The name is applied afterwards: passed to the registration it would also become the
      // account name the authenticator shows in its prompt.
      const result = await authClient.passkey.addPasskey();
      if (!result || result.error || !result.data) {
        setError(result?.error ? describeRegistrationError(result.error) : UNEXPECTED_ERROR);
        return;
      }
      if (name) await authClient.passkey.updatePasskey({ id: result.data.id, name });
      trackEvent('Passkey added');
      window.location.assign('/dashboard?notice=passkey-added');
    });
  }

  async function rename(event: SubmitEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name) return;
    await run(async () => {
      const result = await authClient.passkey.updatePasskey({ id, name });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      setPasskeys((list) =>
        list.map((passkey) => (passkey.id === id ? { ...passkey, name, label: name } : passkey)),
      );
      setReturnTo(id);
      setStep({ kind: 'idle' });
      setStatus('Passkey renamed.');
    });
  }

  async function remove(id: string) {
    await run(async () => {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      trackEvent('Passkey removed');
      window.location.assign('/dashboard?notice=passkey-removed');
    });
  }

  const cancel = (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        setReturnTo(step.kind === 'add' ? 'add' : 'id' in step ? step.id : null);
        setStep({ kind: 'idle' });
      }}
      disabled={loading}
    >
      Cancel
    </Button>
  );

  return (
    <div className="space-y-4" data-passkey-step={step.kind} ref={container}>
      {error && <Alert>{error}</Alert>}
      {status && (
        <Alert variant="success" data-passkeys-status>
          {status}
        </Alert>
      )}

      {passkeys.length > 0 ? (
        <ul className="divide-y rounded-md border" data-passkeys>
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="space-y-3 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{passkey.label}</span>
                    {passkey.synced && <Badge variant="muted">Synced</Badge>}
                  </p>
                  {passkey.createdAt && passkey.createdLabel && (
                    <p className="text-muted-foreground">
                      Added <time dateTime={passkey.createdAt}>{passkey.createdLabel}</time>
                    </p>
                  )}
                </div>
                {step.kind === 'idle' && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep({ kind: 'rename', id: passkey.id })}
                      aria-label={`Rename ${passkey.label}`}
                      data-focus={returnTo === passkey.id || undefined}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => setStep({ kind: 'remove', id: passkey.id })}
                      aria-label={`Remove ${passkey.label}`}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {step.kind === 'rename' && step.id === passkey.id && (
                <form
                  onSubmit={(event) => rename(event, passkey.id)}
                  className="flex flex-wrap items-end gap-2"
                  aria-label={`Rename ${passkey.label}`}
                >
                  <Field className="min-w-48 flex-1">
                    <Label htmlFor={`passkey-name-${passkey.id}`}>New name</Label>
                    <Input
                      id={`passkey-name-${passkey.id}`}
                      name="name"
                      defaultValue={passkey.name ?? ''}
                      placeholder={passkey.label}
                      required
                      maxLength={PASSKEY_NAME_MAX_LENGTH}
                    />
                  </Field>
                  <Button type="submit" variant="outline" loading={loading}>
                    Save
                  </Button>
                  {cancel}
                </form>
              )}

              {step.kind === 'remove' && step.id === passkey.id && (
                <div className="space-y-3" role="group" aria-label={`Remove ${passkey.label}`}>
                  <p className="text-muted-foreground">
                    Remove this passkey? You can no longer sign in with it. Delete it from your
                    device or password manager as well, or it keeps offering a key that no longer
                    works.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => remove(passkey.id)}
                      loading={loading}
                    >
                      Remove passkey
                    </Button>
                    {cancel}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-pretty text-muted-foreground" data-passkeys-empty>
          No passkeys yet. A passkey signs you in with your fingerprint, face or device PIN instead
          of a password, and it cannot be phished.
        </p>
      )}

      {!supported && (
        <p className="text-sm text-pretty text-muted-foreground">
          This browser does not support passkeys. Open the dashboard in a current browser to add
          one.
        </p>
      )}

      {supported && step.kind === 'idle' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep({ kind: 'add' })}
          data-focus={returnTo === 'add' || undefined}
        >
          Add a passkey
        </Button>
      )}

      {step.kind === 'add' && (
        <form onSubmit={add} className="space-y-4" aria-label="Add a passkey">
          <p className="text-sm text-pretty text-muted-foreground">
            Your browser or password manager asks you to confirm with your fingerprint, face or PIN.
            Give the passkey a name if you want to tell it apart later.
          </p>
          <Field>
            <Label htmlFor="new-passkey-name">Name (optional)</Label>
            <Input
              id="new-passkey-name"
              name="name"
              maxLength={PASSKEY_NAME_MAX_LENGTH}
              placeholder="Work laptop"
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              Create passkey
            </Button>
            {cancel}
          </div>
        </form>
      )}
    </div>
  );
}
