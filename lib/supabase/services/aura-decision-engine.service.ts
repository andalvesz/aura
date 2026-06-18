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

async function loadDecisionEngineInput(): Promise<{
  input: DecisionEngineInput | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { input: null, error: "Usuário não autenticado." };

  const [growthBrain, revenueAi, marketHunter, operationCenter, performance] = await Promise.all([
    import("./growth-brain.service").then((mod) => mod.getGrowthBrainDashboard()),
    import("./revenue-ai.service").then((mod) => mod.getRevenueAiDashboard()),
    import("./market-hunter.service").then((mod) => mod.getMarketHunterDashboard()),
    import("./operation-center.service").then((mod) => mod.getOperationCenterState()),
    import("./performance.service").then((mod) => mod.getPerformanceDashboard()),
  ]);

  if (
    growthBrain.error &&
    revenueAi.error &&
    marketHunter.error &&
    operationCenter.error &&
    performance.error
  ) {
    return {
      input: null,
      error: growthBrain.error ?? "Erro ao carregar fontes de decisão.",
    };
  }

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
    },
    error: null,
  };
}

export async function getUnifiedDecisions(): Promise<{
  decisions: UnifiedDecisionEngineResult | null;
  error: string | null;
}> {
  const { input, error } = await loadDecisionEngineInput();
  if (error || !input) return { decisions: null, error: error ?? "Erro ao carregar decisões." };

  return {
    decisions: computeUnifiedDecisions(input),
    error: null,
  };
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
