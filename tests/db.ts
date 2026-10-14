import 'dotenv/config';
import { Client } from 'pg';

/** DB tests run only when the PG* values are set and SKIP_DB_TESTS is not "true" (set it in .env to turn them off). */
export const dbConfigured = Boolean(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER) && process.env.SKIP_DB_TESTS !== 'true';

/** Runs one read-only query and returns the rows. A fresh connection per call keeps parallel workers simple. */
export async function dbRows<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const c = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });
  await c.connect();
  try {
    await c.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    if (process.env.PGSCHEMA) await c.query(`SET search_path TO "${process.env.PGSCHEMA.replace(/"/g, '')}"`);
    const { rows } = await c.query(sql);
    return rows as T[];
  } catch (e) {
    throw new Error(`SQL failed: ${(e as Error).message}\n  ${sql}\n  → run "npm run db:discover" and fix this query in tests/db-queries.ts`);
  } finally {
    await c.end();
  }
}

/** Runs a query that returns a single number (first column of first row). */
export async function dbNumber(sql: string): Promise<number> {
  const rows = await dbRows(sql);
  if (!rows.length) return 0;
  return Number(Object.values(rows[0])[0] ?? 0);
}

/** Equal for counts; for values shown rounded (2.18B, 1.23M) allow the rounding of the display. */
export function sameValue(ui: number, db: number): boolean {
  if (ui === db) return true;
  if (ui < 1000) return Math.round(db * 100) / 100 === ui;
  return Math.abs(ui - db) / Math.max(ui, 1) <= 0.005;
}
