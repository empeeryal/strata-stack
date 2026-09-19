/**
 * Applies the migrations in ./drizzle to DATABASE_URL. For environments without drizzle-kit,
 * such as the Docker image; locally `pnpm db:migrate` does the same.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

import { openDatabase } from './lib/db.ts';

const client = openDatabase();
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
console.log('Migrations applied.');
client.close();
