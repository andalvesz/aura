import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const BLACK_MODULES = [
  "growth-brain", "revenue-ai", "aura-decision-engine", "operation-center", "market-hunter",
  "autopilot", "mission-control", "smart-launch", "performance", "creative-director",
  "ads-commander", "ceo", "kiwify-intelligence", "meta-intelligence", "aura-brain",
  "landing-factory", "copylab", "creative-factory", "campaign-orchestrator",
  "revenue", "execution", "money", "global-intelligence", "knowledge", "integration-center",
];

const BLACK_TABLES = [
  "growth_brain_memories", "growth_patterns", "revenue_metrics", "revenue_forecasts",
  "market_opportunities", "market_watchlist", "operation_center", "autopilot_settings",
  "autopilot_monitors", "autopilot_actions", "autopilot_logs", "aura_smart_launch_sessions",
  "performance_reports", "performance_metrics", "performance_insights", "ad_campaigns",
  "ad_sets", "ad_creatives", "landing_pages", "creative_assets", "aura_ceo_sessions",
  "system_logs",
];

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const corpus = files.map((f) => ({ f, c: fs.readFileSync(f, "utf8") }));

// Circular dynamic imports among Black services
const cycles = [];
for (const svc of BLACK_MODULES) {
  const file = path.join(ROOT, "lib/supabase/services", `${svc}.service.ts`);
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const imports = [...content.matchAll(/import\(["'](\.\/[^"']+)["']\)/g)].map((m) => m[1]);
  for (const imp of imports) {
    const target = imp.replace("./", "").replace(".service", "");
    if (!BLACK_MODULES.includes(target)) continue;
    const rev = path.join(ROOT, "lib/supabase/services", `${target}.service.ts`);
    if (!fs.existsSync(rev)) continue;
    const revContent = fs.readFileSync(rev, "utf8");
    if (revContent.includes(`./${svc}.service`)) cycles.push(`${svc} <-> ${target}`);
  }
}

// Unused services
const servicesDir = path.join(ROOT, "lib/supabase/services");
const allServices = fs.readdirSync(servicesDir)
  .filter((f) => f.endsWith(".service.ts"))
  .map((f) => f.replace(".service.ts", ""));

const unusedServices = [];
for (const svc of allServices) {
  let refs = 0;
  for (const { f, c } of corpus) {
    if (f.includes(`${svc}.service.ts`)) continue;
    if (c.includes(`${svc}.service`)) refs++;
  }
  if (refs === 0) unusedServices.push(svc);
}

// Table usage
const unusedTables = [];
const lowUsageTables = [];
for (const table of BLACK_TABLES) {
  let refs = 0;
  for (const { c } of corpus) {
    const re = new RegExp(`["'\`]${table}["'\`]`, "g");
    const m = c.match(re);
    if (m) refs += m.length;
  }
  if (refs === 0) unusedTables.push(table);
  else if (refs < 3) lowUsageTables.push({ table, refs });
}

// Duplicate feed patterns
const feedPatterns = [
  "feedGrowthBrainFromRevenue",
  "feedGrowthBrainFromPerformance",
  "feedGrowthBrainFromOperation",
  "feedGrowthBrainFromMeta",
  "feedGrowthBrainFromKiwify",
  "feedRevenueAiFromPerformance",
  "feedRevenueAiFromOperation",
  "feedRevenueAiFromMeta",
  "feedRevenueAiFromKiwify",
  "feedMarketHunterFromGrowthBrain",
  "feedMarketHunterFromRevenue",
  "feedMarketHunterFromKiwify",
  "feedMarketHunterFromOperation",
  "registerRevenue",
  "registerCampaignResult",
];

const feedUsage = {};
for (const p of feedPatterns) feedUsage[p] = [];
for (const { f, c } of corpus) {
  for (const p of feedPatterns) {
    if (c.includes(p)) feedUsage[p].push(f.replace(ROOT + path.sep, "").replace(/\\/g, "/"));
  }
}

// Black API routes
const apiDir = path.join(ROOT, "app/api");
const blackApiRoutes = [];
function walkApi(dir, prefix = "") {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkApi(p, `${prefix}/${ent.name}`);
    else if (ent.name === "route.ts") {
      const route = `/api${prefix}`;
      const isBlack = BLACK_MODULES.some((m) => route.includes(m.replace(/-/g, "-"))) ||
        ["mission", "ceo", "performance", "revenue", "autopilot", "meta", "kiwify", "ads-commander", "creative-director", "landing-factory", "operation-center", "growth-brain", "revenue-ai", "market-hunter", "smart-launch", "aura-decision-engine", "aura-central"].some((k) => route.includes(k));
      if (isBlack) {
        let consumers = 0;
        for (const { f, c } of corpus) {
          if (f.includes("route.ts")) continue;
          if (c.includes(route)) consumers++;
        }
        blackApiRoutes.push({ route, consumers, file: p.replace(ROOT + path.sep, "").replace(/\\/g, "/") });
      }
    }
  }
}
walkApi(apiDir);

const orphanRoutes = blackApiRoutes.filter((r) => r.consumers === 0);

console.log(JSON.stringify({
  circularImports: [...new Set(cycles)],
  unusedServices,
  unusedTables,
  lowUsageTables,
  orphanRoutes,
  feedUsage,
  blackApiRouteCount: blackApiRoutes.length,
}, null, 2));
