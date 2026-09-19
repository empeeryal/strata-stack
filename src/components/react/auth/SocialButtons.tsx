import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, UNEXPECTED_ERROR } from '../primitives';

type Provider = 'github' | 'google';

interface SocialButtonsProps {
  providers: Provider[];
  redirectTo?: string;
}

const LABELS: Record<Provider, string> = {
  github: 'Continue with GitHub',
  google: 'Continue with Google',
};

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8"
      />
    </svg>
  );
}

/** OAuth buttons; only providers with credentials configured on the server are passed in. */
export default function SocialButtons({
  providers,
  redirectTo = '/dashboard',
}: SocialButtonsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Provider | null>(null);

  if (providers.length === 0) return null;

  async function signIn(provider: Provider) {
    setError(null);
    setPending(provider);
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: redirectTo });
      if (result.error) {
        setError(result.error.message ?? 'Sign-in failed. Try again.');
        setPending(null);
      }
      // On success the browser navigates to the provider; the button stays busy until then.
    } catch {
      setError(UNEXPECTED_ERROR);
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          loading={pending === provider}
          onClick={() => signIn(provider)}
        >
          {provider === 'github' ? <GitHubIcon /> : <GoogleIcon />}
          {LABELS[provider]}
        </Button>
      ))}
    </div>
  );
}
