/**
 * Supabase connection check — valida URL e testa auth/health.
 * Uso: node --import tsx scripts/check-supabase-connection.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return { path, loaded: false, vars: {} };

  const raw = readFileSync(path, "utf8");
  const vars = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = value;
    if (!process.env[key]) process.env[key] = value;
  }
  return { path, loaded: true, vars };
}

function validateSupabaseUrl(url) {
  if (!url?.trim()) {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL ausente ou vazio." };
  }

  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return {
        ok: false,
        reason: `Host inválido: ${parsed.hostname}. Esperado *.supabase.co`,
      };
    }
    return { ok: true, hostname: parsed.hostname };
  } catch {
    return { ok: false, reason: `URL inválida: ${url}` };
  }
}

function unwrapFetchError(err) {
  const chain = [];
  let current = err;
  while (current) {
    chain.push({
      message: current.message ?? String(current),
      code: current.code ?? current.cause?.code ?? null,
    });
    current = current.cause;
  }
  return chain;
}

function formatConnectionError(hostname, err) {
  const chain = unwrapFetchError(err);
  const codes = chain.map((item) => item.code).filter(Boolean);

  if (codes.includes("ENOTFOUND")) {
    return [
      `DNS ENOTFOUND para ${hostname}.`,
      "O domínio Supabase não resolve — verifique NEXT_PUBLIC_SUPABASE_URL no .env.local.",
      "Confirme o project ref no dashboard Supabase (Project Settings → API).",
      "Se o projeto foi pausado ou removido, restaure-o ou atualize a URL.",
    ].join("\n");
  }

  if (
    codes.some((code) =>
      /CERT|TLS|SSL|UNABLE_TO_VERIFY/i.test(String(code))
    )
  ) {
    return [
      `Falha TLS ao conectar em ${hostname}.`,
      chain[0]?.message ?? "fetch failed",
      "A URL parece válida, mas o Node não conseguiu validar o certificado SSL.",
      "Tente: node --use-system-ca scripts/check-supabase-connection.mjs",
    ].join("\n");
  }

  return chain.map((item) => item.message).join(" → ");
}

const envLocal = loadEnvFile(".env.local");
const envProduction = loadEnvFile(".env.production");

const report = {
  timestamp: new Date().toISOString(),
  env_files: {
    ".env.local": { loaded: envLocal.loaded, path: envLocal.path },
    ".env.production": { loaded: envProduction.loaded, path: envProduction.path },
  },
  url_validation: null,
  connection: null,
  ok: false,
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

report.url_validation = validateSupabaseUrl(url);

if (!report.url_validation.ok) {
  console.error(JSON.stringify(report, null, 2));
  console.error(`\n${report.url_validation.reason}`);
  process.exit(1);
}

if (!anon?.trim()) {
  report.connection = { ok: false, reason: "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente." };
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

const supabase = createClient(url, anon);

try {
  const health = await supabase.from("master_flows").select("id", { count: "exact", head: true });
  if (health.error && !/permission|jwt|auth/i.test(health.error.message)) {
    throw new Error(health.error.message);
  }

  const authProbe = await supabase.auth.getSession();

  report.connection = {
    ok: true,
    hostname: report.url_validation.hostname,
    health_query: health.error ? "skipped_or_rls" : "ok",
    auth_reachable: !authProbe.error,
    session: authProbe.data.session ? "active" : "none",
  };
  report.ok = true;
} catch (err) {
  report.connection = {
    ok: false,
    hostname: report.url_validation.hostname,
    error: formatConnectionError(report.url_validation.hostname, err),
    error_chain: unwrapFetchError(err),
  };
  console.error(JSON.stringify(report, null, 2));
  console.error(`\n${report.connection.error}`);
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
