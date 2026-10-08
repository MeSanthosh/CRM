// npm run db:discover  → writes db-schema.md: tables, row counts, columns, and the
// distinct values of status/type-like columns. Contains NO personal data (no names,
// emails or phone numbers) — only structure and category values — so it is safe to share.
import { writeFileSync } from 'node:fs';
import { openReadOnly } from './pg.mjs';

const schema = process.env.PGSCHEMA ?? 'public';
const CATEGORY_COL = /(status|stage|type|rating|source|category|state|is_|flag|kind|segment)/i;
const PERSONAL_COL = /(name|email|phone|mobile|address|passport|password|token|note|comment|description)/i;
const q = s => `"${s.replace(/"/g, '""')}"`;

const c = await openReadOnly();
const out = [`# Database schema: ${process.env.PGDATABASE} (${schema})`, `Generated ${new Date().toISOString()}`, ''];

const { rows: tables } = await c.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
  [schema],
);

for (const { table_name: t } of tables) {
  const { rows: [{ n }] } = await c.query(`SELECT count(*)::int n FROM ${q(schema)}.${q(t)}`);
  const { rows: cols } = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [schema, t],
  );
  out.push(`## ${t} — ${n} rows`, '', '| column | type | values (count) |', '|---|---|---|');

  for (const col of cols) {
    let values = '';
    const isCategory =
      CATEGORY_COL.test(col.column_name) && !PERSONAL_COL.test(col.column_name) &&
      /(char|text|bool|USER-DEFINED|integer|smallint)/i.test(col.data_type);
    if (isCategory && n > 0) {
      const { rows } = await c.query(
        `SELECT ${q(col.column_name)}::text v, count(*)::int n FROM ${q(schema)}.${q(t)}
          GROUP BY 1 ORDER BY 2 DESC LIMIT 16`,
      );
      if (rows.length <= 15) values = rows.map(r => `${r.v ?? 'NULL'} (${r.n})`).join(', ');
    } else if (/(deleted|archived|_at$|assigned)/i.test(col.column_name) && n > 0) {
      const { rows: [r] } = await c.query(
        `SELECT count(${q(col.column_name)})::int filled FROM ${q(schema)}.${q(t)}`,
      );
      values = `non-null: ${r.filled}, null: ${n - r.filled}`;
    }
    out.push(`| ${col.column_name} | ${col.data_type} | ${values} |`);
  }
  out.push('');
  process.stdout.write('.');
}

await c.end();
writeFileSync('db-schema.md', out.join('\n'));
console.log(`\n✔ Wrote db-schema.md (${tables.length} tables). Send this file to Claude to map the exact SQL.`);
