/**
 * Lista usuários Aura (auth.users + profiles).
 * Requer SUPABASE_SERVICE_ROLE_KEY no .env.local
 * Uso: node --import tsx scripts/list-aura-users.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ausente.");
  process.exit(1);
}

const projectRef = url.match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? "?";
console.log(`Projeto: ${projectRef}`);
console.log(`URL: ${url.replace(/^(https?:\/\/[^.]+).*/, "$1.***")}`);

if (!serviceRole) {
  console.error(`
SEM SUPABASE_SERVICE_ROLE_KEY — impossível listar auth.users via API.

1. Supabase Dashboard → Project Settings → API → service_role (secret)
2. Cole no .env.local:
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
3. Rode de novo: node --import tsx scripts/list-aura-users.mjs

Ou no SQL Editor do Supabase:

select id, email, email_confirmed_at is not null as confirmed,
       created_at, last_sign_in_at
from auth.users
order by created_at;

select id, email, full_name, active_context, active_workspace_id, created_at
from public.profiles
order by created_at;
`);
  process.exit(2);
}

const admin = createClient(url, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [];
let page = 1;
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("listUsers falhou:", error.message);
    process.exit(1);
  }
  users.push(...(data.users ?? []));
  if (!data.users?.length || data.users.length < 200) break;
  page += 1;
}

const { data: profiles, error: profilesError } = await admin
  .from("profiles")
  .select(
    "id, email, full_name, onboarding_completed, active_context, active_workspace_id, created_at"
  )
  .order("created_at", { ascending: true });

if (profilesError) {
  console.warn("profiles:", profilesError.message);
}

const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

console.log(`\nTotal auth.users: ${users.length}`);
console.log(`Total profiles: ${(profiles ?? []).length}\n`);

const rows = users
  .slice()
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  .map((u) => {
    const p = profileById.get(u.id);
    return {
      email: u.email ?? "(sem email)",
      id: u.id,
      confirmed: Boolean(u.email_confirmed_at),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      profile: p
        ? {
            full_name: p.full_name,
            active_context: p.active_context,
            has_workspace: Boolean(p.active_workspace_id),
          }
        : null,
    };
  });

console.table(
  rows.map((r) => ({
    email: r.email,
    confirmed: r.confirmed,
    profile: r.profile ? "yes" : "NO",
    context: r.profile?.active_context ?? "-",
    workspace: r.profile?.has_workspace ? "yes" : "no",
    last_sign_in: r.last_sign_in_at ?? "-",
    created: r.created_at,
  }))
);

for (const r of rows) {
  console.log(
    `- ${r.email} | id=${r.id} | confirmed=${r.confirmed} | profile=${r.profile ? "ok" : "MISSING"}`
  );
}

// anon sanity (should not list all users)
if (anon) {
  const publicClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: anonProfiles, error: anonErr } = await publicClient
    .from("profiles")
    .select("id")
    .limit(5);
  console.log("\nRLS check (anon sem sessão):", {
    rows: anonProfiles?.length ?? 0,
    error: anonErr?.message ?? null,
    note: "Esperado: 0 rows (RLS bloqueia).",
  });
}
