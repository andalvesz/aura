/**
 * UI action inventory — static scan of app routes, nav, buttons, forms, APIs.
 * Usage: node --import tsx scripts/ui-action-inventory.mjs
 * Output: reports/ui-action-inventory.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();

function walk(dir, acc = [], exts = [".ts", ".tsx", ".js", ".jsx"]) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "playwright-report") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc, exts);
    else if (exts.some((e) => name.endsWith(e))) acc.push(p);
  }
  return acc;
}

function routeFromPageFile(file) {
  let rel = relative(join(ROOT, "app"), file).replace(/\\/g, "/");
  if (!rel.endsWith("/page.tsx") && !rel.endsWith("/page.ts")) return null;
  rel = rel.replace(/\/page\.tsx?$/, "");
  const parts = rel.split("/").filter((p) => p && !p.startsWith("(") && !p.startsWith("@"));
  const mapped = parts.map((p) => (p.startsWith("[") ? `:${p.replace(/[\[\]]/g, "")}` : p));
  return "/" + mapped.join("/");
}

function moduleFromRoute(route) {
  if (!route) return "unknown";
  if (route === "/" || route === "/login" || route === "/cadastro") return "auth";
  if (route.startsWith("/convite")) return "auth";
  if (route.startsWith("/dashboard/alvesz")) return "alvesz";
  if (route.startsWith("/dashboard/financeiro") || route.startsWith("/dashboard/saude") ||
      route.startsWith("/dashboard/calendario") || route.startsWith("/dashboard/viagens") ||
      route.startsWith("/dashboard/idiomas") || route.startsWith("/dashboard/metas") ||
      route.startsWith("/dashboard/legado") || route.startsWith("/dashboard/disney")) {
    return "vida";
  }
  if (route.startsWith("/dashboard/memoria") || route.startsWith("/dashboard/integrations") ||
      route.startsWith("/dashboard/diagnostico") || route.startsWith("/dashboard/logs") ||
      route.startsWith("/dashboard/knowledge")) {
    return "aura";
  }
  if (route.startsWith("/dashboard/workspace")) return "configuracoes";
  if (route === "/dashboard") return "dashboard";
  if (route.startsWith("/dashboard")) return "negocios";
  if (route.startsWith("/api/")) return "api";
  return "other";
}

const items = [];

function addItem(partial) {
  items.push({
    modulo: partial.modulo ?? "unknown",
    rota: partial.rota ?? "",
    elemento: partial.elemento ?? "",
    texto_ou_aria: partial.texto_ou_aria ?? "",
    tipo_acao: partial.tipo_acao ?? "unknown",
    seletor_recomendado: partial.seletor_recomendado ?? "",
    implementacao_encontrada: partial.implementacao_encontrada ?? "",
    teste_associado: partial.teste_associado ?? null,
    status: partial.status ?? "NOT_TESTED",
    arquivo: partial.arquivo ?? "",
  });
}

// --- Routes (pages) ---
for (const file of walk(join(ROOT, "app"))) {
  const route = routeFromPageFile(file);
  if (!route) continue;
  addItem({
    modulo: moduleFromRoute(route),
    rota: route === "/" ? "/" : route.replace(/\/$/, "") || "/",
    elemento: "page",
    texto_ou_aria: route,
    tipo_acao: "navigate",
    seletor_recomendado: `url:${route}`,
    implementacao_encontrada: relative(ROOT, file).replace(/\\/g, "/"),
    teste_associado: "e2e/smoke-routes.spec.ts",
    status: "NOT_TESTED",
    arquivo: relative(ROOT, file).replace(/\\/g, "/"),
  });
}

// --- API routes ---
for (const file of walk(join(ROOT, "app", "api"))) {
  if (!/route\.ts$/.test(file)) continue;
  let rel = relative(join(ROOT, "app"), file).replace(/\\/g, "/").replace(/\/route\.ts$/, "");
  const route = "/" + rel;
  const raw = readFileSync(file, "utf8");
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export async function ${method}\\b`).test(raw)) {
      addItem({
        modulo: "api",
        rota: route,
        elemento: `api:${method}`,
        texto_ou_aria: `${method} ${route}`,
        tipo_acao: method.toLowerCase(),
        seletor_recomendado: `api:${method}:${route}`,
        implementacao_encontrada: relative(ROOT, file).replace(/\\/g, "/"),
        teste_associado: route.includes("alvesz-proposta-pdf")
          ? "utils/alvesz-pdf-security.test.ts"
          : null,
        status: "NOT_TESTED",
        arquivo: relative(ROOT, file).replace(/\\/g, "/"),
      });
    }
  }
}

// --- Server actions ---
for (const file of walk(join(ROOT, "app", "actions"))) {
  const raw = readFileSync(file, "utf8");
  if (!raw.includes("use server")) continue;
  const exports = [...raw.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  for (const name of exports) {
    addItem({
      modulo: "server-actions",
      rota: "",
      elemento: `action:${name}`,
      texto_ou_aria: name,
      tipo_acao: "server_action",
      seletor_recomendado: `action:${name}`,
      implementacao_encontrada: relative(ROOT, file).replace(/\\/g, "/"),
      status: "NOT_TESTED",
      arquivo: relative(ROOT, file).replace(/\\/g, "/"),
    });
  }
}

// --- Nav from OS_NAV (static parse of labels/hrefs) ---
{
  const modulesFile = join(ROOT, "lib", "modules.ts");
  if (existsSync(modulesFile)) {
    const raw = readFileSync(modulesFile, "utf8");
    const hrefs = [...raw.matchAll(/href:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    const labels = [...raw.matchAll(/label:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    for (let i = 0; i < hrefs.length; i++) {
      addItem({
        modulo: moduleFromRoute(hrefs[i]),
        rota: hrefs[i],
        elemento: "nav-link",
        texto_ou_aria: labels[i] ?? hrefs[i],
        tipo_acao: "navigate",
        seletor_recomendado: `role=link[name="${labels[i] ?? hrefs[i]}"]`,
        implementacao_encontrada: "lib/modules.ts + components/dashboard/dashboard-nav.tsx",
        teste_associado: "e2e/nav.spec.ts",
        status: "NOT_TESTED",
        arquivo: "lib/modules.ts",
      });
    }
  }
}

// --- Buttons / forms / dead patterns in components + app ---
const DEAD_PATTERNS = [
  { re: /href=["']#["']/, tipo: "DEAD_BUTTON", note: "href=#" },
  { re: /href=["']["']/, tipo: "DEAD_BUTTON", note: "href empty" },
  { re: /em breve/i, tipo: "PLACEHOLDER", note: "em breve" },
  { re: /TODO|FIXME/, tipo: "PLACEHOLDER", note: "TODO/FIXME" },
  { re: /onClick=\{\(\)\s*=>\s*\{\s*\}\}/, tipo: "DEAD_BUTTON", note: "empty onClick" },
  { re: /console\.log\(/, tipo: "PLACEHOLDER", note: "console.log present" },
];

for (const file of [...walk(join(ROOT, "components")), ...walk(join(ROOT, "app"))]) {
  const raw = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  for (const pat of DEAD_PATTERNS) {
    if (pat.re.test(raw)) {
      addItem({
        modulo: rel.includes("alvesz") ? "alvesz" : "ui",
        rota: "",
        elemento: "pattern",
        texto_ou_aria: pat.note,
        tipo_acao: "audit_flag",
        seletor_recomendado: "",
        implementacao_encontrada: pat.note,
        status: pat.tipo,
        arquivo: rel,
      });
    }
  }

  const buttons = [...raw.matchAll(/<(button|Button)([^>]*)>/g)];
  for (const m of buttons.slice(0, 40)) {
    const attrs = m[2] ?? "";
    const aria = attrs.match(/aria-label=["']([^"']+)["']/);
    const textHint = attrs.match(/>\s*([^<{]+)\s*</);
    const hasOnClick = /onClick=/.test(attrs) || /onClick=/.test(raw.slice(m.index, m.index + 200));
    addItem({
      modulo: "ui",
      rota: "",
      elemento: "button",
      texto_ou_aria: aria?.[1] ?? textHint?.[1]?.trim() ?? "(button)",
      tipo_acao: hasOnClick ? "click" : "unknown",
      seletor_recomendado: aria
        ? `role=button[name="${aria[1]}"]`
        : "role=button",
      implementacao_encontrada: hasOnClick ? "onClick present" : "no onClick in open tag",
      status: "NOT_TESTED",
      arquivo: rel,
    });
  }

  if (/<form[\s>]/.test(raw) || /<Form[\s>]/.test(raw)) {
    addItem({
      modulo: "ui",
      rota: "",
      elemento: "form",
      texto_ou_aria: "form",
      tipo_acao: "submit",
      seletor_recomendado: "role=form",
      implementacao_encontrada: "form element",
      status: "NOT_TESTED",
      arquivo: rel,
    });
  }
}

mkdirSync(join(ROOT, "reports"), { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  totals: {
    items: items.length,
    pages: items.filter((i) => i.elemento === "page").length,
    api: items.filter((i) => i.elemento.startsWith("api:")).length,
    nav: items.filter((i) => i.elemento === "nav-link").length,
    buttons: items.filter((i) => i.elemento === "button").length,
    forms: items.filter((i) => i.elemento === "form").length,
    server_actions: items.filter((i) => i.tipo_acao === "server_action").length,
    placeholders: items.filter((i) => i.status === "PLACEHOLDER").length,
    dead_buttons: items.filter((i) => i.status === "DEAD_BUTTON").length,
    not_tested: items.filter((i) => i.status === "NOT_TESTED").length,
  },
  items,
};

writeFileSync(
  join(ROOT, "reports", "ui-action-inventory.json"),
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary.totals, null, 2));
console.log("Wrote reports/ui-action-inventory.json");
