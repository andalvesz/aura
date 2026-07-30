/**
 * Multiuser Security Audit — Sprint 1
 * Uso: npm run multiuser-security-audit
 *
 * Verifica (estático + opcionalmente contra Supabase se houver sessão de auditoria):
 *  - tabelas workspace sem RLS esperada (via migration presence)
 *  - service role no client bundle
 *  - queries potencialmente não escopadas
 *  - helpers de convite/hash
 *  - se DATABASE/service disponíveis: memberships, owners, invites
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  generateInviteToken,
  hashInviteToken,
} from "../lib/workspace/invite-token.ts";
import { WORKSPACE_TABLES } from "../lib/workspace/constants.ts";

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

const findings = [];
let critical = 0;

function fail(msg, severity = "critical") {
  findings.push({ severity, message: msg });
  if (severity === "critical") critical += 1;
}

function ok(msg) {
  findings.push({ severity: "ok", message: msg });
}

function warn(msg) {
  findings.push({ severity: "warn", message: msg });
}

// --- Static: migration present ---
const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260727120000_multiuser_workspaces_v1.sql"
);
const hardeningPath = resolve(
  process.cwd(),
  "supabase/migrations/20260728120000_multiuser_rls_hardening_v1.sql"
);
const integrityReportPath = resolve(
  process.cwd(),
  "supabase/reports/20260728_multiuser_integrity_readonly.sql"
);

if (!existsSync(migrationPath)) {
  fail("Migration multiuser_workspaces_v1 ausente");
} else {
  const sql = readFileSync(migrationPath, "utf8");
  for (const needle of [
    "create table if not exists public.workspaces",
    "create table if not exists public.workspace_members",
    "create table if not exists public.workspace_invites",
    "token_hash",
    "is_workspace_member",
    "accept_workspace_invite",
    "active_workspace_id",
  ]) {
    if (!sql.includes(needle)) fail(`Migration sem: ${needle}`);
  }
  if (sql.includes("token text") && !sql.includes("token_hash")) {
    fail("Convite parece armazenar token em texto puro");
  }
  ok("Migration Sprint 1 presente e contém artefatos esperados");
}

if (!existsSync(hardeningPath)) {
  fail("Migration multiuser_rls_hardening_v1 ausente");
} else {
  const sql = readFileSync(hardeningPath, "utf8");
  for (const needle of [
    "prevent_workspace_id_change",
    "protect_last_workspace_owner",
    "last_owner_protected",
    "workspace_id_immutable",
  ]) {
    if (!sql.includes(needle)) fail(`Hardening migration sem: ${needle}`);
  }
  ok("Migration RLS hardening presente");
}

if (!existsSync(integrityReportPath)) {
  warn("Relatório SQL de integridade ausente");
} else {
  ok("Relatório SQL somente leitura presente");
}

// --- Static: proposta PDF must require workspace context + signed URLs ---
{
  const pdfRoute = resolve(process.cwd(), "app/api/alvesz-proposta-pdf/route.ts");
  if (existsSync(pdfRoute)) {
    const raw = readFileSync(pdfRoute, "utf8");
    if (!raw.includes("requireWorkspaceContext")) {
      fail("alvesz-proposta-pdf POST sem requireWorkspaceContext");
    } else if (!raw.includes("workspace_id")) {
      fail("alvesz-proposta-pdf POST sem workspace_id");
    } else {
      ok("alvesz-proposta-pdf POST escopado por workspace");
    }
    if (raw.includes("getPublicUrl")) {
      fail("alvesz-proposta-pdf POST ainda usa getPublicUrl");
    }
    if (!raw.includes("createSignedUrl")) {
      fail("alvesz-proposta-pdf POST sem createSignedUrl");
    } else {
      ok("alvesz-proposta-pdf POST usa URLs assinadas");
    }
    if (!raw.includes("storage_path não pode ser escolhido")) {
      fail("alvesz-proposta-pdf POST não rejeita storage_path do cliente");
    } else {
      ok("alvesz-proposta-pdf POST rejeita path manipulado pelo cliente");
    }
  }

  const storageMig = resolve(
    process.cwd(),
    "supabase/migrations/20260728140000_alvesz_pdfs_private_storage_v1.sql"
  );
  if (!existsSync(storageMig)) {
    fail("Migration alvesz_pdfs_private_storage_v1 ausente");
  } else {
    const sql = readFileSync(storageMig, "utf8");
    if (!sql.includes("public = false")) fail("Bucket alvesz-pdfs não forçado a privado");
    if (!sql.includes('drop policy if exists "alvesz_pdfs_select_public"')) {
      fail("Migration storage sem drop da policy pública");
    }
    if (!sql.includes("alvesz_pdfs_select_member")) {
      fail("Migration storage sem policy de membro");
    } else {
      ok("Migration storage alvesz-pdfs privada presente");
    }
  }

  const commMig = resolve(
    process.cwd(),
    "supabase/migrations/20260728150000_communication_logs_workspace_refs_v1.sql"
  );
  if (!existsSync(commMig)) {
    fail("Migration communication_logs_workspace_refs ausente");
  } else {
    ok("Migration communication_logs refs presente");
  }
}

// --- Static: service role not in client ---
const clientFiles = [
  "lib/supabase/client.ts",
  "lib/supabase/browser.ts",
  "lib/env.ts",
];
for (const f of clientFiles) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  const raw = readFileSync(p, "utf8");
  if (/SERVICE_ROLE|service_role|serviceRole/i.test(raw)) {
    fail(`Possível service role em client: ${f}`);
  }
}
ok("Client Supabase sem service role aparente");

// --- Static: scan for service role in components/hooks ---
function walkTs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      walkTs(p, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const frontendRoots = ["components", "hooks", "app"].map((d) =>
  resolve(process.cwd(), d)
);
for (const root of frontendRoots) {
  for (const file of walkTs(root)) {
    const raw = readFileSync(file, "utf8");
    if (/SUPABASE_SERVICE_ROLE|service_role_key/i.test(raw)) {
      fail(`Service role no frontend: ${file}`);
    }
  }
}
ok("Scan frontend sem SUPABASE_SERVICE_ROLE");

// --- Static: workspace tables listed ---
if (WORKSPACE_TABLES.length < 6) {
  fail("WORKSPACE_TABLES incompleto");
} else {
  ok(`WORKSPACE_TABLES: ${WORKSPACE_TABLES.join(", ")}`);
}

// --- Token hygiene unit ---
{
  const t = generateInviteToken();
  const h = hashInviteToken(t);
  if (t === h || h.length !== 64) fail("Hash de convite inválido");
  else ok("Hash de convite SHA-256 ok");
}

// --- Live DB checks (anon; only works if tables exist and RLS allows) ---
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function liveAudit() {
  if (!url || !anon) {
    warn("Sem URL/anon — pulando checagens live");
    return;
  }

  const admin = service
    ? createClient(url, service, { auth: { persistSession: false } })
    : null;

  if (!admin) {
    warn(
      "Sem SUPABASE_SERVICE_ROLE_KEY — não foi possível auditar contagens RLS/ownership no banco. Aplique a migration e rode com service role para auditoria completa."
    );
    // Probe with anon whether tables exist
    const client = createClient(url, anon, { auth: { persistSession: false } });
    const { error } = await client.from("workspaces").select("id").limit(1);
    if (error) {
      if (/does not exist|schema cache|PGRST/i.test(error.message)) {
        fail(
          `Tabela workspaces inacessível (migration provavelmente não aplicada): ${error.message}`
        );
      } else {
        warn(`Probe workspaces (esperado sem auth): ${error.message}`);
      }
    } else {
      ok("Tabela workspaces responde ao PostgREST");
    }
    return;
  }

  // With service role: structural checks
  const tables = [
    "workspaces",
    "workspace_members",
    "workspace_invites",
    ...WORKSPACE_TABLES,
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).select("*").limit(1);
    if (error) {
      fail(`Tabela ${table}: ${error.message}`);
    } else {
      ok(`Tabela ${table} acessível`);
    }
  }

  const { data: members, error: memErr } = await admin
    .from("workspace_members")
    .select("workspace_id, user_id, role, status");
  if (memErr) {
    fail(`workspace_members: ${memErr.message}`);
  } else {
    const keys = new Set();
    for (const m of members ?? []) {
      const k = `${m.workspace_id}:${m.user_id}`;
      if (keys.has(k)) fail(`Membership duplicada: ${k}`);
      keys.add(k);
    }
    ok("Sem memberships duplicadas (workspace_id,user_id)");

    const byWs = new Map();
    for (const m of members ?? []) {
      if (m.status !== "active" || m.role !== "owner") continue;
      byWs.set(m.workspace_id, (byWs.get(m.workspace_id) ?? 0) + 1);
    }
    for (const [ws, count] of byWs) {
      if (count !== 1) fail(`Workspace ${ws} tem ${count} owners ativos`);
    }
    ok("Owners: no máximo um owner ativo por workspace verificado");
  }

  for (const table of WORKSPACE_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("id")
      .is("workspace_id", null)
      .limit(5);
    if (error) {
      warn(`${table} null workspace probe: ${error.message}`);
    } else if ((data ?? []).length > 0) {
      fail(`${table} tem registros sem workspace_id`);
    } else {
      ok(`${table}: sem null workspace_id`);
    }
  }

  const now = new Date().toISOString();
  const { data: staleInvites, error: invErr } = await admin
    .from("workspace_invites")
    .select("id, expires_at, accepted_at")
    .is("accepted_at", null)
    .lt("expires_at", now)
    .limit(20);
  if (invErr) warn(`invites: ${invErr.message}`);
  else if ((staleInvites ?? []).length > 0) {
    warn(
      `${staleInvites.length} convite(s) expirado(s) ainda sem accepted_at (ok se rejeitados na accept)`
    );
  } else {
    ok("Sem convites expirados pendentes (ou nenhum convite)");
  }
}

await liveAudit();

const report = {
  timestamp: new Date().toISOString(),
  ok: critical === 0,
  critical,
  findings,
};

console.log(JSON.stringify(report, null, 2));
if (critical > 0) {
  console.error(`\nmultiuser-security-audit: ${critical} finding(s) crítico(s)`);
  process.exit(1);
}
console.log("\nmultiuser-security-audit: OK");
