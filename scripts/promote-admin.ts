/**
 * Grants (or revokes) the admin role for an existing account.
 *
 *   pnpm admin:promote user@example.com
 *   pnpm admin:promote user@example.com --revoke
 *   pnpm admin:promote user@example.com --revoke --force   # even if nobody else is an admin
 *
 * Use it for the first administrator of a deployment when ADMIN_EMAILS was not set before
 * that person signed up, or as the break-glass path when no administrator is left.
 */
import { openDatabase } from './lib/db.ts';

const args = process.argv.slice(2);
const email = args
  .find((arg) => !arg.startsWith('--'))
  ?.trim()
  .toLowerCase();
const revoke = args.includes('--revoke');
const force = args.includes('--force');
if (!email) {
  console.error('Usage: pnpm admin:promote <email> [--revoke] [--force]');
  process.exit(1);
}

const client = openDatabase();

if (revoke && !force) {
  // The app's isAdmin() rule in SQL: an unbanned account whose comma-separated roles include
  // `admin`. Spaces are stripped so "user, admin" counts too.
  const others = await client.execute({
    sql: `SELECT count(*) AS n FROM user
          WHERE email <> ? AND (banned IS NULL OR banned = 0)
            AND (',' || replace(coalesce(role, ''), ' ', '') || ',') LIKE '%,admin,%'`,
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
