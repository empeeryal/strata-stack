/**
 * Whether a Better Auth role string includes `admin`. Better Auth may store several roles as
 * a comma-separated list. Dependency-free so browser scripts can share the rule with the server.
 */
export function hasAdminRole(role: string | null | undefined): boolean {
  return (role ?? '').split(',').some((entry) => entry.trim() === 'admin');
}
