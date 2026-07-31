/**
 * audit:multiuser-context — read-only static audit for cognitive isolation.
 * Usage: npm run audit:multiuser-context
 *
 * Does NOT print sensitive health/memory content.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, relative } from "node:path";

const root = process.cwd();
const findings = [];
let critical = 0;
let warnCount = 0;

function fail(msg) {
  findings.push({ severity: "critical", message: msg });
  critical += 1;
}
function warn(msg) {
  findings.push({ severity: "warn", message: msg });
  warnCount += 1;
}
function ok(msg) {
  findings.push({ severity: "ok", message: msg });
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (
      name.name === "node_modules" ||
      name.name === ".next" ||
      name.name === ".git" ||
      name.name === "playwright-report" ||
      name.name === "test-results"
    ) {
      continue;
    }
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(name.name)) acc.push(p);
  }
  return acc;
}

const LEAK_PATTERNS = [
  { id: "shoulder_injury_hardcode", re: /les[aã]o no ombro direito/i },
  { id: "shoulder_injured_prompt", re: /ombro direito lesionado/i },
  { id: "shoulder_recovery_brand", re: /recupera[cç][aã]o do ombro/i },
  { id: "global_health_cache", re: /["'`]aura:health["'`]/ },
  { id: "global_profile_cache", re: /["'`]aura:profile["'`]/ },
  { id: "global_brain_cache", re: /["'`]aura:brain-context["'`]/ },
];

const ALLOWLIST = [
  "utils/multiuser-isolation.test.ts",
  "scripts/audit-multiuser-context.mjs",
  "reports/critical-multiuser-cognitive-isolation.md",
  "utils/legado.ts", // historical biography seed data — must not be auto-applied
  "e2e/",
];

function isAllowlisted(rel) {
  return ALLOWLIST.some((a) => rel.replace(/\\/g, "/").includes(a));
}

const files = walk(root);
let scanned = 0;

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, "/");
  if (isAllowlisted(rel)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  scanned += 1;
  for (const pat of LEAK_PATTERNS) {
    if (pat.re.test(text)) {
      fail(`[${pat.id}] ${rel}`);
    }
  }
}

// Required isolation artifacts
const required = [
  "lib/context/resolved-user-context.ts",
  "lib/client/session-reset.ts",
  "utils/multiuser-isolation.test.ts",
];
for (const r of required) {
  if (!existsSync(resolve(root, r))) fail(`Artefato ausente: ${r}`);
  else ok(`Artefato presente: ${r}`);
}

const healthCtx = readFileSync(resolve(root, "utils/health.ts"), "utf8");
if (/Anderson Alves/i.test(healthCtx) && /ombro/i.test(healthCtx)) {
  fail("utils/health.ts ainda mistura Anderson + ombro no HEALTH_COACH_CONTEXT");
} else {
  ok("HEALTH_COACH_CONTEXT sem perfil Anderson+ombro");
}

const healthRoute = readFileSync(
  resolve(root, "app/api/health-coach/route.ts"),
  "utf8"
);
if (!healthRoute.includes("assertPersonalSubject")) {
  fail("health-coach route sem assertPersonalSubject");
} else {
  ok("health-coach usa assertPersonalSubject");
}

const contextTs = readFileSync(
  resolve(root, "lib/supabase/services/context.ts"),
  "utf8"
);
if (!contextTs.includes("resolved: ResolvedUserContext") && !contextTs.includes("resolved:")) {
  fail("getDataContext sem ResolvedUserContext");
} else {
  ok("AuraAuditContext inclui resolved");
}

// Singleton / global audit ctx warning
if (contextTs.includes("__AURA_AUDIT_CTX__")) {
  warn(
    "globalThis.__AURA_AUDIT_CTX__ ainda existe (somente auditoria/certificação — risco se setado em request real)"
  );
}

console.log("\n=== audit:multiuser-context ===");
console.log(`Arquivos escaneados: ${scanned}`);
for (const f of findings) {
  const tag =
    f.severity === "critical" ? "CRIT" : f.severity === "warn" ? "WARN" : "OK  ";
  console.log(`[${tag}] ${f.message}`);
}
console.log(`\nCritical: ${critical} | Warn: ${warnCount}`);

const reportDir = resolve(root, "reports");
if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
const out = {
  generatedAt: new Date().toISOString(),
  scanned,
  critical,
  warn: warnCount,
  findings: findings.map((f) => ({
    severity: f.severity,
    message: f.message,
  })),
  status: critical === 0 ? "PASS" : "FAIL",
};
writeFileSync(
  join(reportDir, "multiuser-context-audit.json"),
  JSON.stringify(out, null, 2)
);
console.log("Wrote reports/multiuser-context-audit.json");

if (critical > 0) process.exit(1);
