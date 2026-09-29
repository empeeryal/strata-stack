import { type SubmitEvent, useState } from 'react';

import { authClient } from '@/lib/auth-client';

import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Label,
  PasswordInput,
  UNEXPECTED_ERROR,
} from '../primitives';

export interface TwoFactorSetupProps {
  /** Whether the account already has two-factor authentication turned on. */
  enabled: boolean;
  /** Password accounts only: turning it on, off or regenerating codes needs the password. */
  hasPassword: boolean;
}

type Step = 'idle' | 'password' | 'scan' | 'codes' | 'regenerate' | 'disable';

/** The base32 key from an `otpauth://` URI, for people who cannot scan the QR code. */
function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

/**
 * Turns time-based one-time passwords on and off for the signed-in account through Better
 * Auth's two-factor plugin: password → QR code and key → first code from the app → backup
 * codes. The dashboard reloads with a notice when the state changes, because the header and
 * the account card are server rendered.
 */
export default function TwoFactorSetup({ enabled, hasPassword }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (!hasPassword) {
    return (
      <p className="text-sm text-pretty text-muted-foreground">
        Two-factor authentication needs a password on the account. Signing in with a magic link or a
        connected provider is verified by that mailbox or provider instead.
      </p>
    );
  }

  async function run(work: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await work();
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  function password(event: SubmitEvent<HTMLFormElement>): string {
    return String(new FormData(event.currentTarget).get('password') ?? '');
  }

  async function enable(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = password(event);
    await run(async () => {
      const result = await authClient.twoFactor.enable({ password: current });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      if (result.data.method !== 'totp') {
        setError(UNEXPECTED_ERROR);
        return;
      }
      const { toDataURL } = await import('qrcode');
      setTotpUri(result.data.totpURI);
      setCodes(result.data.backupCodes);
      setQr(await toDataURL(result.data.totpURI, { margin: 1, width: 192 }));
      setStep('scan');
    });
  }

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim();
    await run(async () => {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        setError('That code did not match. Codes change every 30 seconds; try the current one.');
        return;
      }
      setStep('codes');
    });
  }

  async function regenerate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = password(event);
    await run(async () => {
      const result = await authClient.twoFactor.generateBackupCodes({ password: current });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      setCodes(result.data.backupCodes);
      setStep('codes');
    });
  }

  async function disable(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = password(event);
    await run(async () => {
      const result = await authClient.twoFactor.disable({ password: current });
      if (result.error) {
        setError(result.error.message ?? UNEXPECTED_ERROR);
        return;
      }
      window.location.assign('/dashboard?notice=two-factor-disabled');
    });
  }

  function finish() {
    if (enabled) {
      setStep('idle');
      setCodes([]);
      return;
    }
    window.location.assign('/dashboard?notice=two-factor-enabled');
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Could not copy the codes. Write them down instead.');
    }
  }

  const cancel = (
    <Button type="button" variant="ghost" onClick={() => setStep('idle')} disabled={loading}>
      Cancel
    </Button>
  );

  return (
    <div className="space-y-4" data-two-factor-step={step}>
      {error && <Alert>{error}</Alert>}

      {step === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={enabled ? 'success' : 'muted'}>{enabled ? 'On' : 'Off'}</Badge>
          {enabled ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('regenerate')}>
                Regenerate backup codes
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('disable')}>
                Turn off
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => setStep('password')}>
              Turn on two-factor authentication
            </Button>
          )}
        </div>
      )}

      {(step === 'password' || step === 'regenerate' || step === 'disable') && (
        <form
          onSubmit={step === 'password' ? enable : step === 'regenerate' ? regenerate : disable}
          className="space-y-4"
          aria-label={
            step === 'password'
              ? 'Turn on two-factor authentication'
              : step === 'regenerate'
                ? 'Regenerate backup codes'
                : 'Turn off two-factor authentication'
          }
        >
          <p className="text-sm text-muted-foreground">
            {step === 'disable'
              ? 'Confirm with your password. Your authenticator entry and backup codes stop working.'
              : step === 'regenerate'
                ? 'Confirm with your password. The previous backup codes stop working.'
                : 'Confirm with your password to get a QR code for your authenticator app.'}
          </p>
          <Field>
            <Label htmlFor="two-factor-password">Current password</Label>
            <PasswordInput
              id="two-factor-password"
              name="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant={step === 'disable' ? 'danger' : 'primary'}
              loading={loading}
            >
              {step === 'password' ? 'Continue' : step === 'regenerate' ? 'Regenerate' : 'Turn off'}
            </Button>
            {cancel}
          </div>
        </form>
      )}

      {step === 'scan' && (
        <form onSubmit={verify} className="space-y-4" aria-label="Confirm your authenticator">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open your authenticator app and scan the code, or enter the key by hand.</li>
            <li>Enter the six-digit code the app shows to confirm.</li>
          </ol>
          <div className="flex flex-wrap items-start gap-4">
            {qr && (
              <img
                src={qr}
                alt="QR code for your authenticator app"
                width={192}
                height={192}
                className="rounded-md border bg-white p-1"
              />
            )}
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-muted-foreground">Key for manual entry</p>
              <code
                className="block rounded-md bg-muted px-2 py-1 font-mono text-xs break-all"
                data-totp-secret
              >
                {secretFromUri(totpUri)}
              </code>
            </div>
          </div>
          <Field>
            <Label htmlFor="two-factor-code">Code from the app</Label>
            <Input
              id="two-factor-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="max-w-40 font-mono tracking-widest"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={loading}>
              Confirm
            </Button>
            {cancel}
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="space-y-4" data-backup-codes>
          <Alert variant="success">
            {enabled
              ? 'New backup codes are ready. The previous ones no longer work.'
              : 'Two-factor authentication is on.'}{' '}
            Each backup code signs you in once if you lose the authenticator. Store them somewhere
            safe; they are not shown again.
          </Alert>
          <ol className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border bg-muted/40 p-4 font-mono text-sm sm:grid-cols-3">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyCodes}>
              {copied ? 'Copied' : 'Copy codes'}
            </Button>
            <Button type="button" onClick={finish}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
