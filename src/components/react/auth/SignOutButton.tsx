import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Alert, Button, UNEXPECTED_ERROR } from '../primitives';

export default function SignOutButton({ redirectTo = '/' }: { redirectTo?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        // The server session is still valid; say so instead of pretending to be signed out.
        setError(result.error.message ?? 'Sign-out failed. Please try again.');
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setError(UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={onClick} loading={loading}>
        {!loading && <LogOut aria-hidden="true" />}
        Sign out
      </Button>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
