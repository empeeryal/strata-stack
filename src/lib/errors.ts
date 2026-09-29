/** Longest error text stored on a row; keeps stack traces and provider payloads out of the DB. */
export const MAX_ERROR_LENGTH = 500;

/** A short, storable description of an unknown error. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
}
