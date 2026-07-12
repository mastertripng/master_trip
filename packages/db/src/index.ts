import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use a dummy connection string during Vercel build time if DATABASE_URL is missing.
// It will never actually connect during the build phase.
const connectionString = process.env.DATABASE_URL || "postgres://dummy:dummy@localhost/dummy";

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export * from './schema';
export { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';
