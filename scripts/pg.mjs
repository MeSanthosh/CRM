import 'dotenv/config';
import pg from 'pg';

export function connect() {
  const client = new pg.Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });
  return client;
}

/** Every session is forced read-only, so these scripts can never change data. */
export async function openReadOnly() {
  const c = connect();
  await c.connect();
  await c.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
  return c;
}
