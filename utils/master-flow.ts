import type { MasterFlow, MasterFlowStatus, MasterFlowStep } from "@/types/database";
import { isReadyToSellStatus } from "@/utils/revenue-certification";

export const MASTER_FLOW_STEPS: MasterFlowStep[] = [
  "opportunity_engine",
  "validation_engine",
  "product_strategist",
  "decision_engine",
  "product_factory",
  "sales_system",
  "investment_committee",
  "mission_review",
];

export const MASTER_FLOW_STEP_LABELS: Record<MasterFlowStep, string> = {
  opportunity_engine: "Opportunity Engine",
  validation_engine: "Validation Engine",
  product_strategist: "Product Strategist",
  market_hunter: "Market Hunter",
  decision_engine: "Decision Engine",
  product_factory: "Product Factory",
  sales_system: "Sales System",
  investment_committee: "Investment Committee",
  mission_review: "Mission Review",
  copylab: "CopyLab",
  offer_engine: "Offer Engine",
  funnel_engine: "Funnel Engine",
  funnel_pages: "Funnel Pages",
  checkout_engine: "Checkout Engine",
  creative_director: "Creative Director",
  ads_commander: "Ads Commander",
  publish_orchestrator: "Publish Orchestrator",
  commercial_excellence: "Commercial Excellence",
  excellence: "Excellence",
  done: "Concluído",
};

export type MasterFlowMetadata = {
  copylab_id?: string | null;
  factory_id?: string | null;
  operation_id?: string | null;
  offer_id?: string | null;
  landing_id?: string | null;
  creative_asset_id?: string | null;
  opportunity_name?: string | null;
  niche?: string | null;
  country?: string | null;
  language?: string | null;
  avatar?: string | null;
  ticket?: number | null;
  user_intent?: string | null;
  checkout_url?: string | null;
  checkout_id?: string | null;
  funnel_url?: string | null;
  landing_url?: string | null;
  landing_published?: boolean | null;
  campaign_published?: boolean | null;
  product_quality_score?: number | null;
  campaign_id?: string | null;
  excellence_score?: number | null;
  commercial_excellence_score?: number | null;
  decision_score?: number | null;
  decision_reason?: string | null;
  opportunity_engine_score?: number | null;
  opportunity_recommendations?: string[] | null;
  selected_opportunity?: import("@/lib/opportunity/opportunity-types").OpportunityRecommendation | null;
  validation_score?: number | null;
  validation_approved?: boolean | null;
  validation_recommendation?: string | null;
  validation_reasons?: string[] | null;
  product_strategies?: import("@/lib/product-strategist/product-strategist-types").ProductStrategyRecommendation[] | null;
  selected_strategy?: import("@/lib/product-strategist/product-strategist-types").ProductStrategyRecommendation | null;
  product_strategist_score?: number | null;
  product_strategist_explanation?: string | null;
  product_build_brief?: import("@/utils/product-build-brief").ProductBuildBrief | null;
  product_strategy_adherence?: import("@/utils/product-build-brief").ProductStrategyAdherence | null;
  sales_package?: import("@/utils/sales-system").SalesPackage | null;
  sales_pending_items?: string[] | null;
  commercial_score?: number | null;
  ready_to_sell?: boolean | null;
  investment_score?: number | null;
  investment_approved?: boolean | null;
  investment_recommendation?: string | null;
  investment_must_fix?: string[] | null;
  investment_specialists?: import("@/lib/investment-committee/investment-committee-types").InvestmentSpecialistReview[] | null;
  mission_launch_approved?: boolean | null;
  checkout_completion?: import("@/utils/revenue-certification").CheckoutCompletionResult | null;
  commercial_status?: "ready_to_sell" | "incomplete" | null;
  certification_gaps?: string[] | null;
  explicit_publish_approval?: boolean | null;
  last_error?: string | null;
  completed_steps?: MasterFlowStep[];
  knowledge_warnings?: string[] | null;
  checkout_pending?: boolean | null;
  checkout_gap?: string | null;
};

export type MasterFlowStepStatus = {
  step: MasterFlowStep;
  label: string;
  state: "pending" | "active" | "completed" | "failed";
};

export type MasterFlowStatusView = {
  flow: MasterFlow;
  steps: MasterFlowStepStatus[];
  currentLabel: string;
  isComplete: boolean;
  isReadyToSell: boolean;
  canRunNext: boolean;
};

export function readMasterFlowMetadata(flow: MasterFlow): MasterFlowMetadata {
  if (!flow.metadata || typeof flow.metadata !== "object" || Array.isArray(flow.metadata)) {
    return {};
  }
  return flow.metadata as MasterFlowMetadata;
}

export function mergeMasterFlowMetadata(
  current: MasterFlow["metadata"],
  patch: MasterFlowMetadata
): MasterFlow["metadata"] {
  const base = readMasterFlowMetadata({ metadata: current } as MasterFlow);
  return { ...base, ...patch } as MasterFlow["metadata"];
}

const LEGACY_STEP_MAP: Partial<Record<MasterFlowStep, MasterFlowStep>> = {
  excellence: "commercial_excellence",
  market_hunter: "opportunity_engine",
  copylab: "sales_system",
  offer_engine: "sales_system",
  funnel_engine: "sales_system",
  funnel_pages: "sales_system",
  checkout_engine: "sales_system",
  creative_director: "sales_system",
  commercial_excellence: "sales_system",
  ads_commander: "mission_review",
  publish_orchestrator: "mission_review",
};

export function normalizeMasterFlowStep(step: MasterFlowStep): MasterFlowStep {
  return LEGACY_STEP_MAP[step] ?? step;
}

export function getNextMasterFlowStep(step: MasterFlowStep): MasterFlowStep {
  const normalized = normalizeMasterFlowStep(step);
  const index = MASTER_FLOW_STEPS.indexOf(normalized);
  if (index < 0 || index >= MASTER_FLOW_STEPS.length - 1) return "done";
  return MASTER_FLOW_STEPS[index + 1]!;
}

export function computeMasterFlowProgress(step: MasterFlowStep): number {
  if (step === "done") return 100;
  const normalized = normalizeMasterFlowStep(step);
  const index = MASTER_FLOW_STEPS.indexOf(normalized);
  if (index < 0) return 0;
  return Math.round((index / MASTER_FLOW_STEPS.length) * 100);
}

export function buildMasterFlowStatusView(flow: MasterFlow): MasterFlowStatusView {
  const meta = readMasterFlowMetadata(flow);
  const completed = new Set((meta.completed_steps ?? []).map(normalizeMasterFlowStep));
  const activeStep = normalizeMasterFlowStep(flow.current_step);
  const isReadyToSell = isReadyToSellStatus(flow.status) || meta.commercial_status === "ready_to_sell";
  const isComplete =
    isReadyToSell || flow.status === "completed" || activeStep === "done";
  const isFailed = flow.status === "failed";

  const steps: MasterFlowStepStatus[] = MASTER_FLOW_STEPS.map((step) => {
    if (completed.has(step)) {
      return { step, label: MASTER_FLOW_STEP_LABELS[step], state: "completed" };
    }
    if (step === activeStep && !isComplete) {
      return {
        step,
        label: MASTER_FLOW_STEP_LABELS[step],
        state: isFailed ? "failed" : "active",
      };
    }
    return { step, label: MASTER_FLOW_STEP_LABELS[step], state: "pending" };
  });

  return {
    flow,
    steps,
    currentLabel: isReadyToSell
      ? "READY TO SELL"
      : MASTER_FLOW_STEP_LABELS[activeStep],
    isComplete,
    isReadyToSell,
    canRunNext: flow.status === "running" && !isComplete,
  };
}

export function isMasterFlowMutable(status: MasterFlowStatus): boolean {
  return status === "pending" || status === "running";
}
