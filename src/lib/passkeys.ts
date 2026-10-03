import { getAuthenticatorName } from '@better-auth/passkey';

import { formatDate, toISODate } from './utils';

/** A passkey as a page or the export shows it: never the public key or the credential id. */
export interface PasskeyItem {
  id: string;
  /** The name the user gave it, if any. */
  name: string | null;
  /** What to call it: the name, else the authenticator's maker, else "Passkey". */
  label: string;
  /** Whether the authenticator syncs it (an iCloud, Google or password-manager passkey). */
  synced: boolean;
  /** ISO timestamp and display text, formatted on the server so both sides agree. */
  createdAt: string | null;
  createdLabel: string | null;
}

/** The columns of the `passkey` table this module reads. */
export interface PasskeyRow {
  id: string;
  name?: string | null | undefined;
  aaguid?: string | null | undefined;
  backedUp: boolean;
  createdAt?: Date | null | undefined;
}

/**
 * The display name of a passkey. Many authenticators report a model identifier (AAGUID) that
 * Better Auth maps to a maker ("Google Password Manager", "1Password"); platforms that hide it
 * leave the generic word.
 */
export function passkeyLabel(row: Pick<PasskeyRow, 'name' | 'aaguid'>): string {
  const name = row.name?.trim();
  if (name) return name;
  return getAuthenticatorName(row.aaguid) ?? 'Passkey';
}

export function toPasskeyItem(row: PasskeyRow): PasskeyItem {
  return {
    id: row.id,
    name: row.name?.trim() || null,
    label: passkeyLabel(row),
    synced: row.backedUp,
    createdAt: row.createdAt ? toISODate(row.createdAt) : null,
    createdLabel: row.createdAt ? formatDate(row.createdAt) : null,
  };
}
