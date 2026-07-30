/**
 * Aggregate UI functional audit report from inventory + playwright results.
 * Usage: node --import tsx scripts/ui-functional-audit-report.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
mkdirSync(join(ROOT, "reports"), { recursive: true });

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

const inventory = readJson(join(ROOT, "reports", "ui-action-inventory.json"), {
  totals: {},
  items: [],
});
const smoke = readJson(join(ROOT, "reports", "ui-smoke-results.json"), { results: [] });
const pw = readJson(join(ROOT, "reports", "playwright-results.json"), null);

const failures = [];

for (const r of smoke.results ?? []) {
  if (r.status === 500 || r.blank || r.hydrationError || (r.pageErrors?.length ?? 0) > 0) {
    failures.push({
      modulo: "smoke",
      rota: r.route,
      botao: null,
      passos: [`Abrir ${r.route}`],
      esperado: "Página carrega sem 500/blank/hydration/pageerror",
      atual: JSON.stringify({
        status: r.status,
        blank: r.blank,
        hydrationError: r.hydrationError,
        pageErrors: r.pageErrors,
      }),
      console: r.consoleErrors,
      network: r.httpFailures,
      screenshot: null,
      trace: null,
      severidade: r.status === 500 ? "high" : "medium",
      arquivo_provavel: `app${r.route === "/" ? "" : r.route}/page.tsx`,
    });
  }
}

if (pw?.suites) {
  const walk = (suite) => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        for (const r of t.results ?? []) {
          if (r.status === "failed" || r.status === "timedOut") {
            failures.push({
              modulo: suite.title || "e2e",
              rota: spec.title,
              botao: null,
              passos: [spec.title],
              esperado: "TESTED_PASS",
              atual: r.error?.message ?? r.status,
              console: [],
              network: [],
              screenshot: (r.attachments ?? []).find((a) => a.name === "screenshot")?.path ?? null,
              trace: (r.attachments ?? []).find((a) => a.name === "trace")?.path ?? null,
              severidade: "high",
              arquivo_provavel: spec.file ?? null,
            });
          }
        }
      }
    }
  };
  walk(pw);
}

writeFileSync(join(ROOT, "reports", "ui-failures.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: failures.length,
  failures,
}, null, 2));

const placeholders = (inventory.items ?? []).filter((i) => i.status === "PLACEHOLDER");
const dead = (inventory.items ?? []).filter((i) => i.status === "DEAD_BUTTON");

const md = `# UI Functional Audit

Generated: ${new Date().toISOString()}

## Totals

| Métrica | Valor |
|---------|-------|
| Rotas (pages) | ${inventory.totals?.pages ?? 0} |
| Ações inventariadas | ${inventory.totals?.items ?? 0} |
| Botões (scan estático) | ${inventory.totals?.buttons ?? 0} |
| Forms | ${inventory.totals?.forms ?? 0} |
| API handlers | ${inventory.totals?.api ?? 0} |
| Nav links | ${inventory.totals?.nav ?? 0} |
| Server actions | ${inventory.totals?.server_actions ?? 0} |
| Placeholders | ${placeholders.length} |
| Dead buttons / flags | ${dead.length} |
| Smoke probes | ${(smoke.results ?? []).length} |
| Falhas agregadas | ${failures.length} |
| Playwright tests | ${pw?.stats?.expected ?? "n/d"} |
| Playwright passed | ${pw?.stats?.expected != null ? (pw.stats.expected - (pw.stats.unexpected ?? 0) - (pw.stats.skipped ?? 0)) : "n/d"} |
| Playwright failed | ${pw?.stats?.unexpected ?? "n/d"} |
| Playwright skipped | ${pw?.stats?.skipped ?? "n/d"} |

## Status legend

TESTED_PASS · TESTED_FAIL · BLOCKED_ENV · PLACEHOLDER · DEAD_BUTTON · MISSING_ROUTE · PERMISSION_BLOCKED · NOT_TESTED

## Placeholders / dead patterns (static)

${placeholders.slice(0, 40).map((p) => `- **PLACEHOLDER** \`${p.arquivo}\` — ${p.texto_ou_aria}`).join("\n") || "_nenhum_"}

${dead.slice(0, 40).map((p) => `- **DEAD_BUTTON** \`${p.arquivo}\` — ${p.texto_ou_aria}`).join("\n") || ""}

## Failures

${failures.length === 0 ? "_Nenhuma falha agregada ainda (rode E2E)._" : failures.slice(0, 50).map((f, i) => `### ${i + 1}. ${f.rota}
- Módulo: ${f.modulo}
- Esperado: ${f.esperado}
- Atual: ${f.atual}
- Severidade: ${f.severidade}
- Arquivo: ${f.arquivo_provavel ?? "n/d"}
`).join("\n")}

## Corrections made in this sprint

- Alvesz PDF: bucket privado, signed URLs, path canônico
- communication_logs: validação de refs de workspace
- Inventário + Playwright scaffold

## Still manual / blocked by env

- Fluxos destrutivos (create/edit/delete) exigem \`E2E_ALLOW_DESTRUCTIVE=1\` + credenciais em \`.env.e2e\`
- Integrações Google Drive / Gmail / Meta — mock ou BLOCKED_ENV
- Expert Brain processing de cursos reais — nunca nos testes
- Produção: apenas smoke de leitura

## Commands

\`\`\`bash
npm run audit:ui
npm run test:e2e
npm run test:e2e:report
npm run audit:all
\`\`\`
`;

writeFileSync(join(ROOT, "reports", "ui-functional-audit.md"), md);
console.log("Wrote reports/ui-functional-audit.md and reports/ui-failures.json");
console.log(`failures=${failures.length} placeholders=${placeholders.length} dead=${dead.length}`);
