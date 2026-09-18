import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

import { Button } from '../primitives';

export default function SignOutButton({ redirectTo = '/' }: { redirectTo?: string }) {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await authClient.signOut();
    window.location.assign(redirectTo);
  }

  return (
    <Button type="button" variant="outline" onClick={onClick} loading={loading}>
      {!loading && <LogOut aria-hidden="true" />}
      Sign out
    </Button>
  );
}
