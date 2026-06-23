import { recordSystemLog } from "@/lib/logs/record";
import {
  buildDecisionEngineAuraContext,
  computeUnifiedDecisions,
  selectBestCampaign,
  selectBestCountry,
  selectBestCreative,
  selectBestLanguage,
  selectBestLanding,
  selectBestOffer,
  selectBestProduct,
  type DecisionEngineInput,
  type UnifiedDecision,
  type UnifiedDecisionEngineResult,
} from "@/utils/aura-decision-engine";
import { getOptionalDataContext } from "./context";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";
import { resolveMasterFlowIntent } from "@/utils/master-flow-intent";

async function loadDecisionEngineInput(intentInput?: MasterFlowIntentInput | null): Promise<{
  input: DecisionEngineInput | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { input: null, error: "Usuário não autenticado." };

  const [growthBrain, revenueAi, marketHunter, operationCenter, performance, kiwify, meta] =
    await Promise.all([
    import("./growth-brain.service").then((mod) => mod.getGrowthBrainDashboard()),
    import("./revenue-ai.service").then((mod) => mod.getRevenueAiDashboard()),
    import("./market-hunter.service").then((mod) => mod.getMarketHunterDashboard()),
    import("./operation-center.service").then((mod) => mod.getOperationCenterState()),
    import("./performance.service").then((mod) => mod.getPerformanceDashboard()),
    import("./kiwify-intelligence.service").then((mod) => mod.getKiwifyIntelligence()),
    import("./meta-intelligence.service").then((mod) => mod.getMetaIntelligence()),
  ]);

  if (
    growthBrain.error &&
    revenueAi.error &&
    marketHunter.error &&
    operationCenter.error &&
    performance.error &&
    kiwify.error &&
    meta.error
  ) {
    return {
      input: null,
      error: growthBrain.error ?? "Erro ao carregar fontes de decisão.",
    };
  }

  const kiwifyTop = kiwify.data?.metrics.topSellingProducts[0] ?? null;
  const intent = resolveMasterFlowIntent(intentInput);

  return {
    input: {
      growthBrain: growthBrain.dashboard,
      revenueAi: revenueAi.dashboard,
      marketHunter: marketHunter.dashboard,
      operationCenter: operationCenter.dashboard,
      performance: performance.error
        ? null
        : {
            dashboard: performance.dashboard,
            panel: performance.panel,
            analysis: performance.analysis,
            executiveMemory: performance.executiveMemory,
          },
      kiwify: kiwify.data
        ? {
            connected: kiwify.data.connected,
            topProductName: kiwifyTop?.name ?? null,
            topProductRevenue: (kiwify.data.metrics.revenueMonthCents ?? 0) / 100,
            conversionPct: kiwify.data.metrics.conversionPct ?? 0,
          }
        : null,
      meta: meta.data
        ? {
            connected: meta.data.connected,
            topCampaignName: meta.data.metrics.bestCampaign?.name ?? null,
            roas: meta.data.metrics.bestCampaign?.roas ?? meta.data.metrics.performance.roas ?? null,
            spend: meta.data.metrics.performance.spendCents / 100,
          }
        : null,
      intent: intent,
    },
    error: null,
  };
}

export async function getUnifiedDecisionsReadOnly(intentInput?: MasterFlowIntentInput | null): Promise<{
  decisions: UnifiedDecisionEngineResult | null;
  error: string | null;
}> {
  const { input, error } = await loadDecisionEngineInput(intentInput);
  if (error || !input) return { decisions: null, error: error ?? "Erro ao carregar decisões." };
  const { enrichDecisionsWithExpertPatterns } = await import("./expert-brain.service");
  const base = computeUnifiedDecisions(input);
  return { decisions: await enrichDecisionsWithExpertPatterns(base), error: null };
}

export async function getUnifiedDecisions(intentInput?: MasterFlowIntentInput | null): Promise<{
  decisions: UnifiedDecisionEngineResult | null;
  error: string | null;
}> {
  const { decisions, error } = await getUnifiedDecisionsReadOnly(intentInput);
  if (error || !decisions) return { decisions: null, error: error ?? "Erro ao carregar decisões." };
  console.info("[decision-engine] unified decisions computed", {
    sourcesUsed: decisions.sourcesUsed,
    confidence: decisions.confidence,
    bestProduct: decisions.bestProduct?.label ?? null,
    bestCampaign: decisions.bestCampaign?.label ?? null,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "decision-engine",
    mensagem: "Decisões unificadas computadas",
    detalhes: {
      sourcesUsed: decisions.sourcesUsed,
      confidence: decisions.confidence,
      bestProduct: decisions.bestProduct?.label ?? null,
      bestCreative: decisions.bestCreative?.label ?? null,
      bestLanding: decisions.bestLanding?.label ?? null,
      bestCampaign: decisions.bestCampaign?.label ?? null,
    },
  });

  void import("./expert-brain.service")
    .then(({ getExpertContext }) => getExpertContext({ module: "decision-engine" }))
    .then(async ({ context, promptBlock }) => {
      const { recordExpertInfluence } = await import("./expert-influence.service");
      await recordExpertInfluence({
        moduleName: "decision-engine",
        context,
        promptApplied: Boolean(promptBlock.trim()),
      });
    });

  return { decisions, error: null };
}

export async function getDecisionEngineContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const { decisions, error } = await getUnifiedDecisions();
  if (error || !decisions) {
    return { context: "", error: error ?? "Erro ao carregar Decision Engine." };
  }
  return { context: buildDecisionEngineAuraContext(decisions), error: null };
}

export async function consultDecisionEngine(module: string): Promise<{
  decisions: UnifiedDecisionEngineResult | null;
  error: string | null;
}> {
  console.info("[decision-engine] consulting for module", { module });
  const result = await getUnifiedDecisions();
  if (result.decisions) {
    recordSystemLog({
      tipo: "info",
      modulo: "decision-engine",
      mensagem: `Decision Engine consultado por ${module}`,
      detalhes: {
        module,
        confidence: result.decisions.confidence,
        bestProduct: result.decisions.bestProduct?.label ?? null,
        bestCampaign: result.decisions.bestCampaign?.label ?? null,
      },
    });
  }
  return result;
}

export async function resolveBestProduct(): Promise<{
  decision: UnifiedDecision | null;
  error: string | null;
}> {
  const { input, error } = await loadDecisionEngineInput();
  if (error || !input) return { decision: null, error };
  return { decision: selectBestProduct(input), error: null };
}

export {
  selectBestProduct,
  selectBestCountry,
  selectBestLanguage,
  selectBestOffer,
  selectBestCreative,
  selectBestLanding,
  selectBestCampaign,
};

export type { UnifiedDecision, UnifiedDecisionEngineResult, DecisionEngineInput };
