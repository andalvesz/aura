/**
 * Revenue Ready Audit — simula:
 * "Quero vender um produto de emagrecimento nos EUA."
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseIntentFromText,
  resolveMasterFlowIntent,
  injectIntentCandidates,
  scopeMarketHunterDashboard,
  nicheMatches,
  normalizeMarketCountry,
} from "../utils/master-flow-intent.ts";
import { computeUnifiedDecisions } from "../utils/aura-decision-engine.ts";
import { rankProducts } from "../utils/market-hunter.ts";
import { isCheckoutReady, toCheckoutProductSummary } from "../utils/checkout-engine.ts";
import { MASTER_FLOW_STEPS } from "../utils/master-flow.ts";

const ROOT = process.cwd();
const SIMULATION_RAW = "Quero vender um produto de emagrecimento nos EUA.";

const results = [];

function grade(id, label, status, score, notes) {
  results.push({ id, label, status, score, notes });
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function has(file) {
  return fs.existsSync(path.join(ROOT, file));
}

// ─── 1. Intent Injection ───────────────────────────────────────────────────
try {
  const parsed = parseIntentFromText(SIMULATION_RAW);
  const intent = resolveMasterFlowIntent({ raw: SIMULATION_RAW });

  assert.equal(intent.niche?.toLowerCase().includes("emagrecimento"), true, "niche");
  assert.equal(intent.country, "US", "country");
  assert.equal(intent.language, "en-US", "language");

  const baseCandidates = [
    {
      productName: "Curso de Marketing Digital",
      sourcePlatform: "revenue_ai",
      niche: "marketing",
      country: "BR",
      language: "pt-BR",
      currency: "BRL",
      estimatedDemand: 80,
      estimatedCompetition: 40,
      estimatedConversion: 0.05,
    },
    {
      productName: "Programa Fitness BR",
      sourcePlatform: "kiwify",
      niche: "fitness",
      country: "BR",
      language: "pt-BR",
      currency: "BRL",
      estimatedDemand: 70,
      estimatedCompetition: 35,
      estimatedConversion: 0.04,
    },
  ];

  const injected = injectIntentCandidates(baseCandidates, intent);
  const top = injected[0];
  assert.ok(nicheMatches(top.niche ?? top.productName, intent.niche), "top matches niche");

  const mockDashboard = {
    topOportunidades: injected.slice(0, 3).map((c, i) => ({
      id: `opp-${i}`,
      productName: c.productName,
      sourcePlatform: c.sourcePlatform,
      niche: c.niche,
      country: c.country,
      score: 75,
      recommendation: "test",
    })),
    melhorNicho: null,
    melhorPais: null,
    melhorMoeda: null,
    melhorPlataforma: null,
    scoreMedio: 75,
    totalOpportunities: 3,
    watchlist: [],
    report: {
      topRecommendation: "test",
      summary: "test",
      bestProduct: null,
      totalOpportunities: 3,
      avgScore: 75,
    },
  };

  const scoped = scopeMarketHunterDashboard(mockDashboard, intent);
  assert.ok(scoped.topOportunidades.every((o) => nicheMatches(o.niche ?? o.productName, intent.niche)));

  const decisions = computeUnifiedDecisions({
    growthBrain: null,
    revenueAi: null,
    marketHunter: scoped,
    operationCenter: null,
    performance: null,
    kiwify: null,
    meta: null,
    intent,
  });

  assert.ok(decisions.bestProduct, "best product within niche");
  assert.ok(nicheMatches(String(decisions.bestProduct.metadata.niche ?? decisions.bestProduct.label), intent.niche));
  assert.equal(decisions.bestCountry?.label, "US");

  grade(
    "intent_injection",
    "Intent Injection",
    "PASS",
    92,
    `Nicho "${intent.niche}", país ${intent.country}, idioma ${intent.language}. Market Hunter e Decision Engine respeitam o escopo.`
  );
} catch (err) {
  grade("intent_injection", "Intent Injection", "FAIL", 35, String(err?.message ?? err));
}

// ─── 2. Checkout Engine ──────────────────────────────────────────────────
try {
  const checkoutService = read("lib/supabase/services/checkout-engine.service.ts");
  const hooks = {
    productFactory: read("lib/supabase/services/product-factory.service.ts").includes("createCheckout({ productId })"),
    offerEngine: checkoutService.includes("mod.createCheckout"),
    funnelPages: checkoutService.includes("applyCheckoutToProduct"),
    funnelEngine: read("lib/supabase/services/funnel-engine.service.ts").includes("checkout-engine.service"),
  };

  const masterFlowHasCheckout = read("lib/supabase/services/master-flow.service.ts").includes("checkout-engine");
  const hardcodedBrInFeed = checkoutService.includes('country: "BR"');
  const safeMode = read("utils/checkout-engine.ts").includes("CHECKOUT_ENGINE_SAFE_MODE");

  let status = "PASS";
  let score = 85;
  const notes = [];

  if (!hooks.productFactory || !hooks.offerEngine || !hooks.funnelPages) {
    status = "PARTIAL";
    score -= 20;
    notes.push("Hooks downstream incompletos.");
  }
  if (masterFlowHasCheckout) {
    notes.push("Master Flow chama checkout.");
  } else {
    status = "PARTIAL";
    score -= 15;
    notes.push("Master Flow NÃO orquestra checkout — depende de hooks assíncronos nos módulos.");
  }
  if (hardcodedBrInFeed) {
    status = "PARTIAL";
    score -= 10;
    notes.push('feedCheckoutIntegrations fixa country="BR" (ignora intenção EUA).');
  }
  if (safeMode) {
    score -= 5;
    notes.push("Safe mode ativo — revisão manual antes de divulgar.");
  }

  const pendingSummary = toCheckoutProductSummary({
    id: "x",
    user_id: "u",
    product_id: "p",
    platform: "stripe",
    checkout_id: "slug",
    checkout_url: null,
    status: "pending",
    metadata: {},
    created_at: "",
    updated_at: "",
  });
  assert.equal(pendingSummary.ready, false);
  assert.equal(isCheckoutReady("ready_to_sell"), true);

  notes.push(
    `Hooks: factory=${hooks.productFactory}, offer=${hooks.offerEngine}, pages=${hooks.funnelPages}. READY_TO_SELL exige URL + status.`
  );

  grade("checkout_engine", "Checkout Engine", status, score, notes.join(" "));
} catch (err) {
  grade("checkout_engine", "Checkout Engine", "FAIL", 30, String(err?.message ?? err));
}

// ─── 3. Master Flow READY_TO_SELL ────────────────────────────────────────
try {
  const masterFlow = read("lib/supabase/services/master-flow.service.ts");
  const steps = MASTER_FLOW_STEPS;
  const hasIntent = masterFlow.includes("resolveMasterFlowIntent");
  const hasCheckoutStep = steps.includes("checkout") || masterFlow.includes("createCheckout");
  const hasReadyGate = masterFlow.includes("ready_to_sell") || masterFlow.includes("READY_TO_SELL");
  const endsAtExcellence = steps[steps.length - 1] === "excellence";

  let status = "PARTIAL";
  let score = 62;
  const notes = [];

  if (hasIntent) notes.push("Intent injection integrado em createBusiness/executeStep.");
  else {
    status = "FAIL";
    score = 25;
  }

  if (!hasCheckoutStep) {
    notes.push(`Pipeline (${steps.join(" → ")}) não inclui etapa de checkout/monetização.`);
    score -= 12;
  }
  if (!hasReadyGate) {
    notes.push("Sem gate READY_TO_SELL ao concluir o fluxo.");
    score -= 10;
  }
  if (endsAtExcellence) {
    notes.push("Fluxo termina em Excellence — produto/campanha criados, mas venda não garantida.");
  }

  const createsProduct = masterFlow.includes("ensureCreatorProduct");
  const createsFunnel = masterFlow.includes("generateFunnel");
  const createsCampaign = masterFlow.includes("prepareFullCampaign");
  if (createsProduct && createsFunnel && createsCampaign) {
    score += 8;
    notes.push("Cria produto, funil e campanha automaticamente.");
  }

  grade("master_flow_ready", "Master Flow READY_TO_SELL", status, score, notes.join(" "));
} catch (err) {
  grade("master_flow_ready", "Master Flow READY_TO_SELL", "FAIL", 20, String(err?.message ?? err));
}

// ─── 4. Revenue Loop Real ──────────────────────────────────────────────────
try {
  const offerEngine = read("lib/supabase/services/offer-engine.service.ts");
  const checkoutEngine = read("lib/supabase/services/checkout-engine.service.ts");
  const revenueAi = read("lib/supabase/services/revenue-ai.service.ts");
  const growthBrain = read("lib/supabase/services/growth-brain.service.ts");
  const adsCommander = read("lib/supabase/services/ads-commander.service.ts");

  const loops = {
    offerToGrowth: offerEngine.includes("registerCampaignResult"),
    offerToRevenue: offerEngine.includes("registerRevenue"),
    offerToMarketHunter: offerEngine.includes("feedMarketHunterFromGrowthBrain"),
    checkoutToGrowth: checkoutEngine.includes("registerCampaignResult"),
    checkoutToRevenue: checkoutEngine.includes("registerRevenue"),
    revenueRealToGrowth: revenueAi.includes('savedMetricType === "real"'),
    revenueToMarketHunter: revenueAi.includes("feedMarketHunterFromRevenue"),
    growthToMarketHunter: growthBrain.includes("feedMarketHunterFromGrowthBrain"),
    adsToGrowth: adsCommander.includes("registerCampaignResult"),
    adsToRevenue: adsCommander.includes("registerRevenue"),
  };

  const wired = Object.values(loops).filter(Boolean).length;
  const total = Object.keys(loops).length;

  let status = wired >= 8 ? "PARTIAL" : "FAIL";
  let score = Math.round((wired / total) * 70);

  const notes = [
    `Conexões código: ${wired}/${total}.`,
    "Loop de aprendizado existe (Offer/Checkout/Ads → Growth Brain + Revenue AI → Market Hunter).",
    'Métricas "real" só alimentam Growth Brain quando metricType=real (requer plataforma conectada + vendas).',
    "Checkout e Offer registram métricas estimated — não fecham loop com ROAS real automaticamente.",
  ];

  if (loops.revenueRealToGrowth && loops.growthToMarketHunter) {
    score += 10;
  }

  grade("revenue_loop", "Revenue Loop Real", status, score, notes.join(" "));
} catch (err) {
  grade("revenue_loop", "Revenue Loop Real", "FAIL", 25, String(err?.message ?? err));
}

// ─── Dimension scores ──────────────────────────────────────────────────────
const intentScore = results.find((r) => r.id === "intent_injection")?.score ?? 0;
const checkoutScore = results.find((r) => r.id === "checkout_engine")?.score ?? 0;
const masterScore = results.find((r) => r.id === "master_flow_ready")?.score ?? 0;
const loopScore = results.find((r) => r.id === "revenue_loop")?.score ?? 0;

const dimensions = {
  criacao: Math.round(intentScore * 0.35 + masterScore * 0.45 + 15),
  publicacao: Math.round(masterScore * 0.7 + (has("lib/supabase/services/ads-commander.service.ts") ? 20 : 0)),
  monetizacao: Math.round(checkoutScore * 0.85 + masterScore * 0.15),
  aprendizado: Math.round(loopScore * 0.9 + intentScore * 0.1),
  autonomia: Math.round(masterScore * 0.55 + intentScore * 0.25 + loopScore * 0.2),
};

dimensions.criacao = Math.min(100, dimensions.criacao);
dimensions.publicacao = Math.min(100, dimensions.publicacao);
dimensions.monetizacao = Math.min(100, dimensions.monetizacao);
dimensions.aprendizado = Math.min(100, dimensions.aprendizado);
dimensions.autonomia = Math.min(100, dimensions.autonomia);

const overall = Math.round(
  (dimensions.criacao +
    dimensions.publicacao +
    dimensions.monetizacao +
    dimensions.aprendizado +
    dimensions.autonomia) /
    5
);

const readyForTraffic =
  overall >= 75 &&
  results.find((r) => r.id === "intent_injection")?.status === "PASS" &&
  results.find((r) => r.id === "checkout_engine")?.status !== "FAIL";

const report = {
  simulation: SIMULATION_RAW,
  timestamp: new Date().toISOString(),
  stages: results,
  dimensions,
  overall,
  verdict: {
    readyForTraffic,
    summary: readyForTraffic
      ? "Parcialmente — pipeline cria ativos, mas monetização real depende de plataforma conectada."
      : "Não totalmente — faltam checkout garantido e loop de receita real para tráfego pago com confiança.",
  },
};

console.log(JSON.stringify(report, null, 2));
