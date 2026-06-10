const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', 'backend', '.env');
const env = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
}

const tables = [
  'users',
  'projects',
  'project_workers',
  'calendar_events',
  'cameras',
  'urgent_tasks',
  'turnstile_access_logs',
  'project_events',
];

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || env.DB_PORT || 5432),
    user: process.env.DB_USER || env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || env.DB_NAME || 'construction_crm',
  });

  await client.connect();

  const existingTablesResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `,
  );
  const existingTables = new Set(existingTablesResult.rows.map((row) => row.table_name));
  const selectedTables = tables.filter((table) => existingTables.has(table));

  const lines = [
    '-- Demo data for the construction CRM project.',
    '-- Restore after backend has created tables with TypeORM synchronize.',
    '-- Example: psql -h localhost -U postgres -d construction_crm -f database/demo-data.sql',
    '',
    "SET client_encoding = 'UTF8';",
    '',
    'BEGIN;',
    '',
    `TRUNCATE TABLE ${selectedTables.map(quoteIdent).join(', ')} RESTART IDENTITY CASCADE;`,
    '',
  ];

  for (const table of selectedTables) {
    const columnResult = await client.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [table],
    );
    const columns = columnResult.rows.map((row) => row.column_name);
    const dataResult = await client.query(`SELECT * FROM ${quoteIdent(table)}`);

    lines.push(`-- ${table}: ${dataResult.rowCount} rows`);
    if (dataResult.rowCount === 0) {
      lines.push('');
      continue;
    }

    const quotedColumns = columns.map(quoteIdent).join(', ');
    for (const row of dataResult.rows) {
      const values = columns.map((column) => sqlValue(row[column])).join(', ');
      lines.push(`INSERT INTO ${quoteIdent(table)} (${quotedColumns}) VALUES (${values});`);
    }
    lines.push('');
  }

  lines.push('COMMIT;', '');

  const outDir = path.join(__dirname, '..', 'database');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'demo-data.sql'), lines.join('\n'), 'utf8');

  await client.end();
  console.log(`Exported ${selectedTables.length} tables to database/demo-data.sql`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
