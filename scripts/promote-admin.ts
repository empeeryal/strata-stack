/**
 * Grants (or revokes) the admin role for an existing account.
 *
 *   pnpm admin:promote user@example.com
 *   pnpm admin:promote user@example.com --revoke
 *
 * Use this for the first administrator of a deployment when ADMIN_EMAILS was not set
 * before that person signed up. Works against the local file database or Turso.
 */
import { createClient } from '@libsql/client';

const email = process.argv[2]?.trim().toLowerCase();
const revoke = process.argv.includes('--revoke');
if (!email) {
  console.error('Usage: pnpm admin:promote <email> [--revoke]');
  process.exit(1);
}

const url = process.env.DATABASE_URL ?? 'file:./.data/local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

const result = await client.execute({
  sql: 'UPDATE user SET role = ?, updated_at = ? WHERE email = ?',
  args: [revoke ? 'user' : 'admin', Date.now(), email],
});

if (result.rowsAffected === 0) {
  console.error(`No account with email ${email}. Sign up first, then run this again.`);
  process.exit(1);
}
console.log(`${email} is now ${revoke ? 'a regular user' : 'an administrator'}.`);
client.close();
