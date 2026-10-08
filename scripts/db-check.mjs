// npm run db:check  → verifies the .env settings can reach the database
import { openReadOnly } from './pg.mjs';

try {
  const c = await openReadOnly();
  const { rows } = await c.query(
    `SELECT current_database() db, current_user usr, version() ver,
            (SELECT count(*) FROM information_schema.tables
              WHERE table_schema = $1 AND table_type = 'BASE TABLE') tables`,
    [process.env.PGSCHEMA ?? 'public'],
  );
  const r = rows[0];
  console.log(`✔ Connected to "${r.db}" as "${r.usr}" — ${r.tables} tables in schema ${process.env.PGSCHEMA ?? 'public'}`);
  console.log(`  ${r.ver.split(',')[0]}`);
  await c.end();
} catch (e) {
  console.error(`✖ Could not connect: ${e.message}`);
  console.error('  Check PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD / PGSSL in .env');
  process.exit(1);
}
