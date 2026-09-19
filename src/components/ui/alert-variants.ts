export type AlertVariant = 'danger' | 'success' | 'info';

/** Shared by the Astro and React alerts so feedback looks the same everywhere. */
export const alertVariants: Record<AlertVariant, string> = {
  danger: 'rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger',
  success: 'rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success',
  info: 'rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground',
};

/** Errors interrupt (`alert`), everything else waits its turn (`status`). */
export function alertRole(variant: AlertVariant): 'alert' | 'status' {
  return variant === 'danger' ? 'alert' : 'status';
}
