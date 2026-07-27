/**
 * Applies multiuser Sprint 1 migration via DATABASE_URL / SUPABASE_DB_URL.
 * Fallback: prints SQL path for Supabase SQL Editor.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node --import tsx scripts/apply-multiuser-migration.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const path = resolve(process.cwd(), ".env.local");
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvLocal();

const migration = resolve(
  process.cwd(),
  "supabase/migrations/20260727120000_multiuser_workspaces_v1.sql"
);

if (!existsSync(migration)) {
  console.error("Migration file not found:", migration);
  process.exit(1);
}

const sql = readFileSync(migration, "utf8");
const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL;

if (!dbUrl) {
  console.log(`
============================================================
MULTIUSER MIGRATION — aplicação manual necessária
============================================================
Arquivo: supabase/migrations/20260727120000_multiuser_workspaces_v1.sql

1. Abra o Supabase Dashboard → SQL Editor
2. Cole o conteúdo do arquivo acima
3. Execute (Run)
4. Rode: npm run multiuser-security-audit

Opcional: defina DATABASE_URL (connection string do Postgres)
e execute este script novamente para aplicar via CLI.
============================================================
`);
  process.exit(0);
}

const { default: pg } = await import("pg").catch(() => ({ default: null }));
if (!pg) {
  console.error(
    "Pacote 'pg' não instalado. Instale com: npm i -D pg\nou aplique a migration no SQL Editor."
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("Migration multiuser_workspaces_v1 aplicada com sucesso.");
} finally {
  await client.end();
}
