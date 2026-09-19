/**
 * Grants (or revokes) the admin role for an existing account.
 *
 *   pnpm admin:promote user@example.com
 *   pnpm admin:promote user@example.com --revoke
 *   pnpm admin:promote user@example.com --revoke --force   # even if nobody else is an admin
 *
 * Use this for the first administrator of a deployment when ADMIN_EMAILS was not set
 * before that person signed up, or as the break-glass path when no administrator is left.
 * Works against the local file database or Turso.
 */
import { createClient } from '@libsql/client';

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes('--revoke');
const force = process.argv.includes('--force');
if (!email || email.startsWith('--')) {
  console.error('Usage: pnpm admin:promote <email> [--revoke] [--force]');
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

if (revoke && !force) {
  // Same rule as the admin UI: never leave the deployment without an active administrator.
  const others = await client.execute({
    sql: "SELECT count(*) AS n FROM user WHERE email <> ? AND (banned IS NULL OR banned = 0) AND (role = 'admin' OR role LIKE 'admin,%' OR role LIKE '%,admin' OR role LIKE '%,admin,%')",
    args: [email],
  });
  if (Number(others.rows[0]?.n ?? 0) === 0) {
    console.error(
      `${email} is the only active administrator. Promote someone else first, or pass --force.`,
    );
    client.close();
    process.exit(1);
  }
}

const result = await client.execute({
  sql: 'UPDATE user SET role = ?, updated_at = ? WHERE email = ?',
  args: [revoke ? 'user' : 'admin', Date.now(), email],
});

if (result.rowsAffected === 0) {
  console.error(`No account with email ${email}. Sign up first, then run this again.`);
  client.close();
  process.exit(1);
}
console.log(`${email} is now ${revoke ? 'a regular user' : 'an administrator'}.`);
client.close();
