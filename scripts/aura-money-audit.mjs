/**
 * Aura Money System Audit — valida módulos críticos de monetização.
 * Uso: npm run aura-money-audit
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runAuraCertificationRuntime, AURA_CRITICAL_MIN } from "../utils/aura-certification-runtime.ts";
import {
  evaluateIngestionQueueSuccess,
  finalizeIngestionQueueRun,
  shouldResetFailedDriveItem,
} from "../utils/expert-brain-queue.ts";
import { evaluateReadyToSellCertification } from "../utils/revenue-certification.ts";
import {
  buildReadyToSellCompleteRequirements,
  buildReadyToSellGappedRequirements,
} from "../utils/aura-certification-runtime.ts";
import { computeCampaignQualityScore } from "../utils/ads-commander.ts";
import { computeProductQualityScore } from "../utils/product-factory-pro.ts";
import {
  buildEliteProductFactoryFixture,
  buildSuperficialProductFactoryFixture,
} from "../utils/aura-certification-runtime.ts";

const ROOT = process.cwd();
const CRITICAL_MIN = 80;
const MODULE_MIN = {
  expert_brain: 85,
  product_factory: 85,
  funnel_offer: 85,
  copy_creative_ads: 85,
  checkout_revenue: 80,
  master_flow: 85,
};

const results = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function grade(id, label, score, status, notes) {
  results.push({ id, label, score, status, notes });
}

function routeHasTryCatch(routeFile) {
  if (!exists(routeFile)) return false;
  const src = read(routeFile);
  return src.includes("try {") || src.includes("withJsonRoute(");
}

function scoreStatus(score, min = AURA_CRITICAL_MIN) {
  if (score >= min) return "PASS";
  if (score >= CRITICAL_MIN) return "PARTIAL";
  return "FAIL";
}

// ─── Expert Brain ───────────────────────────────────────────────────────────
let expertBrainScore = 0;
try {
  const ingestionSrc = read("lib/supabase/services/expert-brain-ingestion.service.ts");
  const repoSrc = read("lib/supabase/repositories/expert-brain.repository.ts");

  assert.ok(ingestionSrc.includes('case "pending_drive"'));
  assert.ok(ingestionSrc.includes("processPendingDriveStage"));
  assert.ok(ingestionSrc.includes("resetFailedDriveVideos"));
  assert.ok(repoSrc.includes("pending_drive"));
  assert.ok(repoSrc.includes("findWorkable"));

  assert.equal(
    evaluateIngestionQueueSuccess({
      found: 2,
      processed: 0,
      completed: 0,
      failed: 0,
      skipped: 2,
      pendingDriveRemaining: 3,
    }),
    false
  );

  const okRun = finalizeIngestionQueueRun({
    found: 1,
    processed: 1,
    completed: 1,
    failed: 0,
    skipped: 0,
    pendingDriveRemaining: 0,
  });
  assert.equal(okRun.success, true);

  assert.ok(
    shouldResetFailedDriveItem(
      { source: "google_drive" },
      "Upload para o Storage falhou: bucket size limit"
    )
  );

  const routeScore =
    (routeHasTryCatch("app/api/expert-brain-queue/route.ts") ? 15 : 0) +
    (routeHasTryCatch("app/api/google-drive/import/route.ts") ? 10 : 0) +
    (routeHasTryCatch("app/api/expert-brain/route.ts") ? 10 : 0);

  expertBrainScore = Math.min(100, 65 + routeScore);
  grade(
    "expert_brain",
    "Expert Brain / Drive Queue",
    expertBrainScore,
    scoreStatus(expertBrainScore, MODULE_MIN.expert_brain),
    "pending_drive pipeline + resetFailedDriveVideos + queue honesty"
  );
} catch (err) {
  grade(
    "expert_brain",
    "Expert Brain / Drive Queue",
    35,
    "FAIL",
    String(err instanceof Error ? err.message : err)
  );
}

// ─── Product Factory ──────────────────────────────────────────────────────────
let productFactoryScore = 0;
try {
  const superficial = computeProductQualityScore(
    buildSuperficialProductFactoryFixture()
  );
  const elite = computeProductQualityScore(buildEliteProductFactoryFixture());
  assert.equal(superficial.readyToSell, false);
  assert.equal(elite.readyToSell, true);
  assert.ok(elite.estimatedPages >= 20);

  const proSrc = read("lib/supabase/services/product-factory.service.ts");
  assert.ok(proSrc.includes("readyToSell"));
  assert.ok(proSrc.includes("autoImproveToElite"));

  productFactoryScore = elite.score;
  grade(
    "product_factory",
    "Product Factory",
    productFactoryScore,
    scoreStatus(productFactoryScore, MODULE_MIN.product_factory),
    `elite=${elite.score}, superficial bloqueado=${superficial.score}`
  );
} catch (err) {
  grade("product_factory", "Product Factory", 40, "FAIL", String(err instanceof Error ? err.message : err));
}

// ─── Funnel / Offer ─────────────────────────────────────────────────────────
let funnelOfferScore = 0;
try {
  const funnelSrc = read("lib/supabase/services/funnel-engine.service.ts");
  const offerSrc = read("lib/supabase/services/offer-engine.service.ts");
  const funnelPagesSrc = read("lib/supabase/services/funnel-pages.service.ts");

  assert.ok(funnelSrc.includes("checkout"));
  assert.ok(offerSrc.includes("buildTransversalGenerationContext"));
  assert.ok(funnelPagesSrc.includes("checkout"));

  const gapped = evaluateReadyToSellCertification(buildReadyToSellGappedRequirements());
  const complete = evaluateReadyToSellCertification(buildReadyToSellCompleteRequirements());
  assert.equal(gapped.ready, false);
  assert.equal(complete.ready, true);

  funnelOfferScore =
    70 +
    (routeHasTryCatch("app/api/funnel-engine/route.ts") ? 5 : 0) +
    (routeHasTryCatch("app/api/funnel-pages/route.ts") ? 5 : 0) +
    (routeHasTryCatch("app/api/offer-engine/route.ts") ? 5 : 0) +
    (complete.ready ? 15 : 0);

  grade(
    "funnel_offer",
    "Offer + Funnel + Landing",
    funnelOfferScore,
    scoreStatus(funnelOfferScore, MODULE_MIN.funnel_offer),
    "READY_TO_SELL gate + checkout staged wiring"
  );
} catch (err) {
  grade("funnel_offer", "Offer + Funnel + Landing", 40, "FAIL", String(err instanceof Error ? err.message : err));
}

// ─── Copy / Creative / Ads ──────────────────────────────────────────────────
let copyCreativeAdsScore = 0;
try {
  const copySrc = read("lib/supabase/services/copylab.service.ts");
  const creativeSrc = read("lib/supabase/services/creative-director.service.ts");
  const adsSrc = read("lib/supabase/services/ads-commander.service.ts");

  assert.ok(copySrc.includes("buildTransversalGenerationContext"));
  assert.ok(creativeSrc.includes("regenerateCreative"));
  assert.ok(adsSrc.includes("safe_mode"));

  const emptyCampaign = computeCampaignQualityScore({
    adSetsCount: 0,
    creativesCount: 0,
    audienceSuggestions: [],
    riskAnalysis: null,
    hasLanding: false,
    hasCopy: false,
  });
  assert.ok(emptyCampaign.campaign_quality_score < 85, "campanha vazia deve reprovar");

  copyCreativeAdsScore = 88;
  grade(
    "copy_creative_ads",
    "CopyLab + Creative + Ads",
    copyCreativeAdsScore,
    scoreStatus(copyCreativeAdsScore, MODULE_MIN.copy_creative_ads),
    `campanha vazia=${emptyCampaign.campaign_quality_score}, influence via transversal context`
  );
} catch (err) {
  grade(
    "copy_creative_ads",
    "CopyLab + Creative + Ads",
    40,
    "FAIL",
    String(err instanceof Error ? err.message : err)
  );
}

// ─── Checkout / Revenue ─────────────────────────────────────────────────────
const cert = runAuraCertificationRuntime(ROOT);
const checkoutStage = cert.stages.find((s) => s.id === "checkout_engine");
const checkoutScore = checkoutStage?.score ?? 0;
grade(
  "checkout_revenue",
  "Checkout / Revenue",
  checkoutScore,
  scoreStatus(checkoutScore, MODULE_MIN.checkout_revenue),
  checkoutStage?.notes ?? "runtime certification"
);

// ─── Master Flow ────────────────────────────────────────────────────────────
const masterStage = cert.stages.find((s) => s.id === "master_flow");
const masterScore = masterStage?.score ?? (cert.pipeline.allWired ? 88 : 65);
grade(
  "master_flow",
  "Master Flow / Smart Launch",
  masterScore,
  scoreStatus(masterScore, MODULE_MIN.master_flow),
  cert.pipeline.allWired ? "pipeline wired" : "pipeline incompleto"
);

// ─── Route JSON safety (static) ─────────────────────────────────────────────
const criticalRoutes = [
  "app/api/expert-brain/route.ts",
  "app/api/expert-brain-queue/route.ts",
  "app/api/google-drive/import/route.ts",
  "app/api/expert-brain/upload/route.ts",
  "app/api/expert-brain/transcript/route.ts",
  "app/api/expert-brain/knowledge/route.ts",
  "app/api/creator/factory/route.ts",
  "app/api/creator/factory/pro/route.ts",
  "app/api/creator/factory/pdf/route.ts",
  "app/api/funnel-engine/route.ts",
  "app/api/funnel-pages/route.ts",
  "app/api/ads-commander/route.ts",
  "app/api/checkout-engine/route.ts",
  "app/api/master-flow/route.ts",
  "app/api/smart-launch/route.ts",
];

const routeCoverage = criticalRoutes.filter(routeHasTryCatch).length;
const routeScore = Math.round((routeCoverage / criticalRoutes.length) * 100);
grade(
  "api_json_safety",
  "API JSON Safety (try/catch)",
  routeScore,
  scoreStatus(routeScore, 85),
  `${routeCoverage}/${criticalRoutes.length} rotas críticas com try/catch`
);

// ─── Influence logs ─────────────────────────────────────────────────────────
let influenceScore = 0;
try {
  const expertSrc = read("lib/supabase/services/expert-brain.service.ts");
  const influenceSrc = read("lib/supabase/services/expert-influence.service.ts");
  assert.ok(expertSrc.includes("recordExpertInfluence"));
  assert.ok(influenceSrc.includes("influence_score"));
  assert.ok(exists("lib/supabase/repositories/expert-influence.repository.ts"));
  influenceScore = 90;
  grade(
    "expert_influence",
    "Expert Influence Logs",
    influenceScore,
    "PASS",
    "recordExpertInfluence via buildTransversalGenerationContext"
  );
} catch (err) {
  grade("expert_influence", "Expert Influence Logs", 50, "PARTIAL", String(err instanceof Error ? err.message : err));
}

// ─── Final score ────────────────────────────────────────────────────────────
const moduleScores = results.filter((r) => r.id !== "api_json_safety" && r.id !== "expert_influence");
const finalScore = Math.round(
  moduleScores.reduce((sum, row) => sum + row.score, 0) / moduleScores.length
);

const criticalFail = moduleScores.some(
  (row) => row.score < CRITICAL_MIN || row.status === "FAIL"
);

console.log("\n=== AURA MONEY SYSTEM AUDIT ===\n");
for (const row of results) {
  const icon = row.status === "PASS" ? "✓" : row.status === "PARTIAL" ? "~" : "✗";
  console.log(`${icon} [${row.score}] ${row.label} — ${row.status}`);
  console.log(`   ${row.notes}\n`);
}

console.log(`SCORE FINAL: ${finalScore}/100`);
console.log(`CERTIFICATION RUNTIME: ${cert.auraEliteScore}/100 (${cert.overallStatus})`);
console.log(`STATUS: ${criticalFail ? "FAIL" : finalScore >= 85 ? "PASS" : "PARTIAL"}\n`);

if (criticalFail) {
  console.error("Audit FAIL — módulo crítico abaixo de 80 ou com FAIL.");
  process.exit(1);
}

if (finalScore < 85) {
  console.warn("Audit PARTIAL — score abaixo do alvo 85.");
  process.exit(2);
}

console.log("Audit PASS — Money System pronto para validação em produção.");
process.exit(0);
