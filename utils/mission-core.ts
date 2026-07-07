import type { MasterFlow, MasterFlowStatus, MasterFlowStep } from "@/types/database";
import {
  MASTER_FLOW_STEPS,
  normalizeMasterFlowStep,
  readMasterFlowMetadata,
  type MasterFlowMetadata,
} from "@/utils/master-flow";
import { isReadyToSellStatus, validateCheckoutUrl } from "@/utils/revenue-certification";

import type { InvestmentSpecialistReview } from "@/lib/investment-committee/investment-committee-types";
import type { SalesPackage } from "@/utils/sales-system";

export const MISSION_APPROVAL_GATE_STEP: MasterFlowStep = "mission_review";
export const RUN_UNTIL_BLOCKED_MAX_STEPS = 14;

export const MISSION_KNOWLEDGE_STEPS = new Set<MasterFlowStep>([
  "product_factory",
  "sales_system",
]);

export type MissionArtifacts = {
  product: { id: string | null; name: string | null };
  offer: { id: string | null };
  landing: { id: string | null; url: string | null };
  copy: { id: string | null };
  creatives: { id: string | null };
  campaign: { id: string | null; prepared: boolean };
  checkout: { id: string | null; url: string | null };
};

export type MissionPublicationChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type MissionStrategySummary = {
  type: string;
  name: string;
  ticket: number;
  launch_time: number;
  reason: string;
};

export type MissionProductAdherence = {
  score: number;
  aligned: boolean;
  pendencies: string[];
};

export type MissionSalesPackageView = {
  product: SalesPackage["product"];
  offer: SalesPackage["offer"];
  landing: SalesPackage["landing"];
  copy: SalesPackage["copy"];
  creatives: SalesPackage["creativePackage"];
  checkout: SalesPackage["checkout"];
  commercialScore: number;
  readyToSell: boolean;
  pendingItems: string[];
};

export type MissionStatus = {
  flow_id: string;
  status: MasterFlow["status"];
  current_step: MasterFlowStep;
  completed_steps: MasterFlowStep[];
  failed_step: MasterFlowStep | null;
  blocked_reason: string | null;
  artifacts: MissionArtifacts;
  next_action: string;
  knowledge_warnings: string[];
  progress: number;
  is_complete: boolean;
  is_ready_for_review: boolean;
  pendencies: string[];
  publication_checklist: MissionPublicationChecklistItem[];
  opportunity_name: string | null;
  last_error: string | null;
  selected_strategy: MissionStrategySummary | null;
  product_adherence: MissionProductAdherence | null;
  sales_package: MissionSalesPackageView | null;
  commercial_score: number | null;
  ready_to_sell: boolean;
  investment_score: number | null;
  investment_approved: boolean;
  investment_recommendation: string | null;
  investment_must_fix: string[];
  investment_specialists: InvestmentSpecialistReview[];
  mission_launch_approved: boolean;
};

export type RunIterationPlan =
  | "complete"
  | "failed"
  | "blocked"
  | "skip_completed"
  | "execute"
  | "max_iterations";

export function shouldBlockBeforeExecution(step: MasterFlowStep): boolean {
  return normalizeMasterFlowStep(step) === MISSION_APPROVAL_GATE_STEP;
}

export function isStepCompleted(flow: MasterFlow, step: MasterFlowStep): boolean {
  const meta = readMasterFlowMetadata(flow);
  const completed = new Set((meta.completed_steps ?? []).map(normalizeMasterFlowStep));
  return completed.has(normalizeMasterFlowStep(step));
}

export function isMissionTerminal(flow: MasterFlow): boolean {
  const activeStep = normalizeMasterFlowStep(flow.current_step);
  return (
    flow.status === "failed" ||
    flow.status === "paused" ||
    flow.status === "completed" ||
    isReadyToSellStatus(flow.status) ||
    activeStep === "done"
  );
}

export function planRunUntilBlockedIteration(input: {
  flow: MasterFlow;
  iteration: number;
  maxIterations?: number;
}): RunIterationPlan {
  const { flow, iteration, maxIterations = RUN_UNTIL_BLOCKED_MAX_STEPS } = input;
  const activeStep = normalizeMasterFlowStep(flow.current_step);

  if (iteration >= maxIterations) return "max_iterations";
  if (isMissionTerminal(flow)) return "complete";
  if (flow.status === "failed") return "failed";
  if (shouldBlockBeforeExecution(activeStep)) return "blocked";
  if (isStepCompleted(flow, activeStep)) return "skip_completed";
  return "execute";
}

export function buildMissionArtifacts(meta: MasterFlowMetadata, flow: MasterFlow): MissionArtifacts {
  const campaignId = flow.campaign_id ?? meta.campaign_id ?? null;
  const completed = new Set((meta.completed_steps ?? []).map(normalizeMasterFlowStep));
  const adsPrepared = completed.has("ads_commander") || Boolean(campaignId);

  return {
    product: {
      id: flow.product_id ?? null,
      name: meta.opportunity_name ?? null,
    },
    offer: { id: meta.offer_id ?? null },
    landing: {
      id: meta.landing_id ?? null,
      url: meta.landing_url ?? meta.funnel_url ?? null,
    },
    copy: { id: meta.copylab_id ?? null },
    creatives: { id: meta.creative_asset_id ?? null },
    campaign: {
      id: campaignId,
      prepared: adsPrepared || Boolean(campaignId),
    },
    checkout: {
      id: meta.checkout_id ?? null,
      url: meta.checkout_url ?? null,
    },
  };
}

export function isLandingPublished(meta: MasterFlowMetadata): boolean {
  return meta.landing_published === true;
}

export function buildMissionPendencies(meta: MasterFlowMetadata, flow: MasterFlow): string[] {
  const pendencies: string[] = [];
  const artifacts = buildMissionArtifacts(meta, flow);

  for (const item of meta.sales_pending_items ?? []) {
    if (!pendencies.includes(item)) pendencies.push(item);
  }

  if (!meta.checkout_url?.trim()) {
    pendencies.push("Checkout não conectado");
  }

  if (artifacts.landing.id && !isLandingPublished(meta)) {
    pendencies.push("Landing ainda não publicada");
  }

  if (artifacts.campaign.prepared && meta.explicit_publish_approval !== true) {
    pendencies.push("Campanha preparada, aguardando aprovação");
  }

  if (!meta.explicit_publish_approval && normalizeMasterFlowStep(flow.current_step) === MISSION_APPROVAL_GATE_STEP) {
    pendencies.push("Publicação — aguardando sua aprovação para publicar funil e campanha.");
  }

  if ((meta.certification_gaps ?? []).length > 0) {
    for (const gap of meta.certification_gaps ?? []) {
      if (!pendencies.includes(gap)) pendencies.push(gap);
    }
  }

  return pendencies;
}

export function buildPublicationChecklist(
  meta: MasterFlowMetadata,
  flow: MasterFlow
): MissionPublicationChecklistItem[] {
  const artifacts = buildMissionArtifacts(meta, flow);
  const sales = meta.sales_package;
  return [
    { id: "product", label: "Produto", done: sales?.product.ready ?? Boolean(artifacts.product.id) },
    { id: "offer", label: "Oferta", done: sales?.offer.ready ?? Boolean(artifacts.offer.id) },
    { id: "landing", label: "Landing", done: sales?.landing.ready ?? Boolean(artifacts.landing.id) },
    { id: "copy", label: "Copy", done: sales?.copy.ready ?? Boolean(artifacts.copy.id) },
    { id: "creatives", label: "Criativos", done: sales?.creativePackage.ready ?? Boolean(artifacts.creatives.id) },
    { id: "checkout", label: "Checkout", done: sales?.checkout.ready ?? Boolean(artifacts.checkout.url) },
    {
      id: "commercial",
      label: "Commercial Score ≥ 90",
      done: (meta.commercial_score ?? sales?.commercialScore ?? 0) >= 90,
    },
    {
      id: "ready",
      label: "Ready To Sell",
      done: meta.ready_to_sell === true || sales?.readyToSell === true,
    },
    {
      id: "investment",
      label: "Investment Score ≥ 90",
      done: (meta.investment_score ?? 0) >= 90,
    },
    {
      id: "investment_approved",
      label: "Investment Approved",
      done: meta.investment_approved === true,
    },
    {
      id: "approve",
      label: "Aprovado para lançamento",
      done: meta.mission_launch_approved === true,
    },
  ];
}

export function computeMissionNextAction(input: {
  flow: MasterFlow;
  blocked_reason: string | null;
  failed_step: MasterFlowStep | null;
}): string {
  const { flow, blocked_reason, failed_step } = input;
  const meta = readMasterFlowMetadata(flow);
  const activeStep = normalizeMasterFlowStep(flow.current_step);

  if (flow.status === "failed" || failed_step) {
    return meta.last_error
      ? `Corrija o problema e clique em Continuar: ${meta.last_error}`
      : "Corrija o erro e clique em Continuar missão.";
  }

  if (blocked_reason || shouldBlockBeforeExecution(activeStep)) {
    if (meta.investment_approved === false && meta.investment_recommendation) {
      return meta.investment_recommendation;
    }
    return "Missão pronta para revisão — analise o pacote comercial e aprove para lançamento.";
  }

  if (isStepCompleted(flow, "sales_system") && activeStep === "mission_review") {
    if (meta.investment_approved !== true) {
      return meta.investment_recommendation ?? "Não recomendo investir dinheiro nesta missão. Corrija os pontos indicados pelo Investment Committee.";
    }
    return "Revise o pacote comercial e clique em Aprovar para lançamento.";
  }

  if (isMissionTerminal(flow)) {
    return "Missão preparada para revisão — revise o pacote e resolva as pendências.";
  }

  if (!meta.checkout_url?.trim() && isStepCompleted(flow, "checkout_engine")) {
    return "Conecte uma plataforma de pagamento para ativar o checkout.";
  }

  return "Clique em Continuar missão para gerar os próximos ativos.";
}

export function canMarkReadyToSell(meta: MasterFlowMetadata, flow: MasterFlow): boolean {
  const artifacts = buildMissionArtifacts(meta, flow);
  const productScore = meta.product_quality_score ?? meta.excellence_score ?? 0;
  const campaignPrepared = artifacts.campaign.prepared;
  const approvalReady =
    meta.explicit_publish_approval === true ||
    normalizeMasterFlowStep(flow.current_step) === MISSION_APPROVAL_GATE_STEP;

  return (
    validateCheckoutUrl(meta.checkout_url) &&
    isLandingPublished(meta) &&
    productScore >= 85 &&
    campaignPrepared &&
    approvalReady
  );
}

export function isReadyForReview(flow: MasterFlow): boolean {
  const meta = readMasterFlowMetadata(flow);
  const activeStep = normalizeMasterFlowStep(flow.current_step);

  if (meta.sales_package && isStepCompleted(flow, "sales_system")) {
    return (
      (isStepCompleted(flow, "investment_committee") || activeStep === "investment_committee") &&
      (activeStep === "mission_review" || flow.status === "paused")
    );
  }

  const artifacts = buildMissionArtifacts(meta, flow);
  const hasCorePackage =
    Boolean(artifacts.product.id) &&
    Boolean(artifacts.copy.id) &&
    Boolean(artifacts.offer.id) &&
    Boolean(artifacts.landing.id);

  const campaignPrepared = artifacts.campaign.prepared;
  const blockedAtPublish =
    shouldBlockBeforeExecution(activeStep) ||
    isStepCompleted(flow, "ads_commander");

  return hasCorePackage && (campaignPrepared || blockedAtPublish);
}

export function buildMissionSalesPackageView(
  meta: MasterFlowMetadata
): MissionSalesPackageView | null {
  const pkg = meta.sales_package;
  if (!pkg) return null;

  return {
    product: pkg.product,
    offer: pkg.offer,
    landing: pkg.landing,
    copy: pkg.copy,
    creatives: pkg.creativePackage,
    checkout: pkg.checkout,
    commercialScore: pkg.commercialScore,
    readyToSell: pkg.readyToSell,
    pendingItems: pkg.pendingItems,
  };
}

export function buildMissionStrategySummary(
  meta: MasterFlowMetadata
): MissionStrategySummary | null {
  const selected = meta.selected_strategy;
  if (selected) {
    return {
      type: selected.strategyType,
      name: selected.strategyName,
      ticket: selected.ticket,
      launch_time: selected.estimatedLaunchTime,
      reason: selected.reason,
    };
  }

  const brief = meta.product_build_brief;
  if (brief) {
    return {
      type: brief.selected_strategy_type,
      name: brief.selected_strategy_name,
      ticket: brief.ticket,
      launch_time: brief.estimated_launch_time,
      reason: brief.reason,
    };
  }

  return null;
}

export function buildMissionProductAdherence(
  meta: MasterFlowMetadata
): MissionProductAdherence | null {
  if (meta.product_strategy_adherence) {
    return {
      score: meta.product_strategy_adherence.score,
      aligned: meta.product_strategy_adherence.aligned,
      pendencies: meta.product_strategy_adherence.pendencies,
    };
  }
  return null;
}

export function buildMissionStatus(
  flow: MasterFlow,
  extras?: {
    failed_step?: MasterFlowStep | null;
    blocked_reason?: string | null;
    knowledge_warnings?: string[];
  }
): MissionStatus {
  const meta = readMasterFlowMetadata(flow);
  const completed_steps = (meta.completed_steps ?? []).map(normalizeMasterFlowStep);
  const activeStep = normalizeMasterFlowStep(flow.current_step);
  const blocked_reason =
    extras?.blocked_reason ??
    (shouldBlockBeforeExecution(activeStep) && flow.status === "running"
      ? "Missão pronta para revisão — aprove o pacote comercial para lançamento."
      : null);

  const failed_step =
    extras?.failed_step ?? (flow.status === "failed" ? activeStep : null);

  const knowledge_warnings = [
    ...(meta.knowledge_warnings ?? []),
    ...(extras?.knowledge_warnings ?? []),
  ];

  return {
    flow_id: flow.id,
    status: flow.status,
    current_step: activeStep,
    completed_steps,
    failed_step,
    blocked_reason,
    artifacts: buildMissionArtifacts(meta, flow),
    next_action: computeMissionNextAction({ flow, blocked_reason, failed_step }),
    knowledge_warnings: [...new Set(knowledge_warnings)],
    progress: flow.progress,
    is_complete: isMissionTerminal(flow),
    is_ready_for_review: isReadyForReview(flow),
    pendencies: buildMissionPendencies(meta, flow),
    publication_checklist: buildPublicationChecklist(meta, flow),
    opportunity_name: meta.opportunity_name ?? null,
    last_error: meta.last_error ?? null,
    selected_strategy: buildMissionStrategySummary(meta),
    product_adherence: buildMissionProductAdherence(meta),
    sales_package: buildMissionSalesPackageView(meta),
    commercial_score: meta.commercial_score ?? meta.sales_package?.commercialScore ?? null,
    ready_to_sell: meta.ready_to_sell === true || meta.sales_package?.readyToSell === true,
    investment_score: meta.investment_score ?? null,
    investment_approved: meta.investment_approved === true,
    investment_recommendation: meta.investment_recommendation ?? null,
    investment_must_fix: meta.investment_must_fix ?? [],
    investment_specialists: meta.investment_specialists ?? [],
    mission_launch_approved: meta.mission_launch_approved === true,
  };
}

export function missionStepProgressLabel(step: MasterFlowStep): string {
  const labels: Partial<Record<MasterFlowStep, string>> = {
    opportunity_engine: "Descobrindo oportunidades",
    validation_engine: "Validando oportunidade",
    product_strategist: "Definindo formato do produto",
    market_hunter: "Analisando oportunidade",
    decision_engine: "Consolidando decisão",
    product_factory: "Criando produto",
    sales_system: "Montando pacote comercial",
    investment_committee: "Auditoria do Investment Committee",
    mission_review: "Revisão da missão",
    copylab: "Escrevendo copy",
    offer_engine: "Montando oferta",
    funnel_engine: "Estruturando funil",
    funnel_pages: "Criando landing",
    checkout_engine: "Configurando checkout",
    creative_director: "Gerando criativos",
    ads_commander: "Preparando campanha",
    publish_orchestrator: "Aguardando publicação",
    commercial_excellence: "Certificando pacote",
    done: "Concluído",
  };
  return labels[normalizeMasterFlowStep(step)] ?? "Em andamento";
}

export function countMissionAssetsReady(artifacts: MissionArtifacts): number {
  let count = 0;
  if (artifacts.product.id) count += 1;
  if (artifacts.offer.id) count += 1;
  if (artifacts.landing.id) count += 1;
  if (artifacts.copy.id) count += 1;
  if (artifacts.creatives.id) count += 1;
  if (artifacts.checkout.url) count += 1;
  return count;
}

export function missionStepsForDisplay(): MasterFlowStep[] {
  return MASTER_FLOW_STEPS.filter((step) => step !== "commercial_excellence");
}
