import type { MasterFlow, MasterFlowStatus, MasterFlowStep } from "@/types/database";

export const MASTER_FLOW_STEPS: MasterFlowStep[] = [
  "market_hunter",
  "decision_engine",
  "product_factory",
  "copylab",
  "offer_engine",
  "funnel_engine",
  "funnel_pages",
  "creative_director",
  "ads_commander",
  "excellence",
];

export const MASTER_FLOW_STEP_LABELS: Record<MasterFlowStep, string> = {
  market_hunter: "Market Hunter",
  decision_engine: "Decision Engine",
  product_factory: "Product Factory",
  copylab: "CopyLab",
  offer_engine: "Offer Engine",
  funnel_engine: "Funnel Engine",
  funnel_pages: "Funnel Pages",
  creative_director: "Creative Director",
  ads_commander: "Ads Commander",
  excellence: "Excellence",
  done: "Concluído",
};

export type MasterFlowMetadata = {
  copylab_id?: string | null;
  factory_id?: string | null;
  operation_id?: string | null;
  opportunity_name?: string | null;
  niche?: string | null;
  country?: string | null;
  language?: string | null;
  avatar?: string | null;
  ticket?: number | null;
  user_intent?: string | null;
  last_error?: string | null;
  completed_steps?: MasterFlowStep[];
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

export function getNextMasterFlowStep(step: MasterFlowStep): MasterFlowStep {
  const index = MASTER_FLOW_STEPS.indexOf(step);
  if (index < 0 || index >= MASTER_FLOW_STEPS.length - 1) return "done";
  return MASTER_FLOW_STEPS[index + 1]!;
}

export function computeMasterFlowProgress(step: MasterFlowStep): number {
  if (step === "done") return 100;
  const index = MASTER_FLOW_STEPS.indexOf(step);
  if (index < 0) return 0;
  return Math.round((index / MASTER_FLOW_STEPS.length) * 100);
}

export function buildMasterFlowStatusView(flow: MasterFlow): MasterFlowStatusView {
  const completed = new Set(readMasterFlowMetadata(flow).completed_steps ?? []);
  const activeStep = flow.current_step;
  const isComplete = flow.status === "completed" || activeStep === "done";
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
    currentLabel: MASTER_FLOW_STEP_LABELS[activeStep],
    isComplete,
    canRunNext: flow.status === "running" && !isComplete,
  };
}

export function isMasterFlowMutable(status: MasterFlowStatus): boolean {
  return status === "pending" || status === "running";
}
