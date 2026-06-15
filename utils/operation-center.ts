import type { OperationCenter, OperationCenterStatus } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";

export const OPERATION_CENTER_SAFE_MODE = true;

export type OperationStepId =
  | "produto"
  | "persona"
  | "oferta"
  | "copy"
  | "criativos"
  | "landing"
  | "meta_ads"
  | "performance_ai"
  | "aprovacao";

export type OperationStepStatus = "pending" | "in_progress" | "done";

export type OperationSteps = Record<OperationStepId, OperationStepStatus>;

export const OPERATION_PROGRESS_STEPS: { id: OperationStepId; label: string }[] = [
  { id: "produto", label: "Produto" },
  { id: "persona", label: "Persona" },
  { id: "oferta", label: "Oferta" },
  { id: "copy", label: "Copy" },
  { id: "criativos", label: "Criativos" },
  { id: "landing", label: "Landing" },
  { id: "meta_ads", label: "Meta Ads" },
  { id: "performance_ai", label: "Performance AI" },
  { id: "aprovacao", label: "Aprovação" },
];

export const OPERATION_SCORE_WEIGHTS: Record<string, number> = {
  produto: 10,
  persona: 10,
  oferta: 10,
  copy: 10,
  criativos: 15,
  landing: 10,
  meta_conectada: 10,
  kiwify_conectada: 10,
  performance_ai: 10,
  roi_previsto: 5,
};

export type OperationCenterCoachMode =
  | "op-missing-approval"
  | "op-continue"
  | "op-generate-creatives"
  | "op-prepare-campaign"
  | "op-approve"
  | "op-status";

export type OperationProgressItem = {
  id: OperationStepId;
  label: string;
  status: OperationStepStatus;
};

export type OperationCenterDashboard = {
  operation: OperationCenter | null;
  productName: string | null;
  progress: OperationProgressItem[];
  operationalScore: number;
  successChance: number | null;
  nextSteps: string[];
  missingForApproval: string[];
  canApprove: boolean;
  safeMode: {
    active: boolean;
    message: string;
  };
  integrations: {
    metaConnected: boolean;
    kiwifyConnected: boolean;
    hasPerformanceReport: boolean;
  };
};

export type OperationExecutiveLogEntry = {
  at: string;
  action: string;
  message: string;
  details?: Record<string, unknown>;
};

const DEFAULT_STEPS: OperationSteps = {
  produto: "pending",
  persona: "pending",
  oferta: "pending",
  copy: "pending",
  criativos: "pending",
  landing: "pending",
  meta_ads: "pending",
  performance_ai: "pending",
  aprovacao: "pending",
};

const OP_MISSING_APPROVAL_PHRASES = [
  "o que falta para aprovar",
  "falta para aprovar",
  "posso aprovar",
  "pronto para aprovar",
] as const;

const OP_CONTINUE_PHRASES = [
  "continue a operacao",
  "continue a operação",
  "continuar operacao",
  "continuar operação",
  "proximo passo da operacao",
  "próximo passo da operação",
] as const;

const OP_GENERATE_CREATIVES_PHRASES = [
  "gere os criativos",
  "gerar criativos",
  "gerar criativo",
  "crie os criativos",
] as const;

const OP_PREPARE_CAMPAIGN_PHRASES = [
  "monte a campanha",
  "montar campanha",
  "preparar campanha",
  "monte campanha",
] as const;

const OP_APPROVE_PHRASES = [
  "aprovar operacao",
  "aprovar operação",
  "aprove a operacao",
  "aprove a operação",
] as const;

const OP_STATUS_PHRASES = [
  "status da operacao",
  "status da operação",
  "operacao ativa",
  "operação ativa",
  "operation center",
  "centro de operacao",
  "centro de operação",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export function detectOperationCenterCoachMode(message: string): OperationCenterCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;

  if (matchesAny(normalized, OP_MISSING_APPROVAL_PHRASES)) return "op-missing-approval";
  if (matchesAny(normalized, OP_CONTINUE_PHRASES)) return "op-continue";
  if (matchesAny(normalized, OP_GENERATE_CREATIVES_PHRASES)) return "op-generate-creatives";
  if (matchesAny(normalized, OP_PREPARE_CAMPAIGN_PHRASES)) return "op-prepare-campaign";
  if (matchesAny(normalized, OP_APPROVE_PHRASES)) return "op-approve";
  if (matchesAny(normalized, OP_STATUS_PHRASES)) return "op-status";

  return null;
}

export function parseOperationSteps(raw: unknown): OperationSteps {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STEPS };
  const obj = raw as Record<string, unknown>;
  const result = { ...DEFAULT_STEPS };
  for (const key of Object.keys(DEFAULT_STEPS) as OperationStepId[]) {
    const value = obj[key];
    if (value === "pending" || value === "in_progress" || value === "done") {
      result[key] = value;
    }
  }
  return result;
}

export function parseOperationNextSteps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function parseExecutiveLogs(raw: unknown): OperationExecutiveLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is OperationExecutiveLogEntry => {
      if (!item || typeof item !== "object") return false;
      const entry = item as OperationExecutiveLogEntry;
      return (
        typeof entry.at === "string" &&
        typeof entry.action === "string" &&
        typeof entry.message === "string"
      );
    })
    .slice(0, 50);
}

export function getOperationStatusLabel(status: OperationCenterStatus): string {
  const labels: Record<OperationCenterStatus, string> = {
    draft: "Rascunho",
    preparing: "Preparando",
    ready: "Pronta",
    approved: "Aprovada",
    cancelled: "Cancelada",
  };
  return labels[status];
}

export function getOperationStatusColor(status: OperationCenterStatus): string {
  const colors: Record<OperationCenterStatus, string> = {
    draft: "text-zinc-400 bg-zinc-700/30",
    preparing: "text-amber-300 bg-amber-500/15",
    ready: "text-emerald-300 bg-emerald-500/15",
    approved: "text-cyan-300 bg-cyan-500/15",
    cancelled: "text-red-300 bg-red-500/15",
  };
  return colors[status];
}

export function getOperationStepStatusLabel(status: OperationStepStatus): string {
  const labels: Record<OperationStepStatus, string> = {
    pending: "Pendente",
    in_progress: "Em andamento",
    done: "Concluído",
  };
  return labels[status];
}

export function getOperationStepStatusColor(status: OperationStepStatus): string {
  const colors: Record<OperationStepStatus, string> = {
    pending: "text-zinc-500 bg-zinc-700/30",
    in_progress: "text-amber-300 bg-amber-500/15",
    done: "text-emerald-300 bg-emerald-500/15",
  };
  return colors[status];
}

export function computeOperationSteps(params: {
  operation: OperationCenter;
  bundle: CreatorProductBundle | null;
  metaConnected: boolean;
  kiwifyConnected: boolean;
  hasPerformanceReport: boolean;
}): OperationSteps {
  const { operation, bundle, metaConnected, kiwifyConnected, hasPerformanceReport } = params;

  const hasProduct = Boolean(operation.product_id);
  const hasPersona = Boolean(
    bundle?.product.avatar?.trim() || bundle?.product.publico_alvo?.trim()
  );
  const hasOffer = Boolean(bundle?.offer);
  const hasCopy = Boolean(operation.copylab_id);
  const hasCreatives = Boolean(operation.assets_id);
  const hasLanding = Boolean(operation.landing_id);
  const hasMeta = Boolean(operation.orchestration_id || metaConnected);
  const hasPerformance = Boolean(operation.performance_report_id || hasPerformanceReport);
  const isReady = operation.status === "ready" || operation.status === "approved";

  function resolve(done: boolean, started: boolean): OperationStepStatus {
    if (done) return "done";
    if (started || operation.status === "preparing") return "in_progress";
    return "pending";
  }

  return {
    produto: resolve(hasProduct, hasProduct),
    persona: resolve(hasPersona, Boolean(bundle?.product)),
    oferta: resolve(hasOffer, Boolean(bundle?.product)),
    copy: resolve(hasCopy, hasCopy || operation.status === "preparing"),
    criativos: resolve(hasCreatives, hasCreatives || operation.status === "preparing"),
    landing: resolve(hasLanding, hasLanding || operation.status === "preparing"),
    meta_ads: resolve(hasMeta, metaConnected || Boolean(operation.orchestration_id)),
    performance_ai: resolve(hasPerformance, hasPerformance || operation.status === "preparing"),
    aprovacao: isReady ? "done" : operation.status === "preparing" ? "in_progress" : "pending",
  };
}

export function computeOperationalScore(params: {
  steps: OperationSteps;
  metaConnected: boolean;
  kiwifyConnected: boolean;
  roiPrevisto: number | null;
}): number {
  const { steps, metaConnected, kiwifyConnected, roiPrevisto } = params;
  let score = 0;

  if (steps.produto === "done") score += OPERATION_SCORE_WEIGHTS.produto;
  if (steps.persona === "done") score += OPERATION_SCORE_WEIGHTS.persona;
  if (steps.oferta === "done") score += OPERATION_SCORE_WEIGHTS.oferta;
  if (steps.copy === "done") score += OPERATION_SCORE_WEIGHTS.copy;
  if (steps.criativos === "done") score += OPERATION_SCORE_WEIGHTS.criativos;
  if (steps.landing === "done") score += OPERATION_SCORE_WEIGHTS.landing;
  if (metaConnected || steps.meta_ads === "done") score += OPERATION_SCORE_WEIGHTS.meta_conectada;
  if (kiwifyConnected) score += OPERATION_SCORE_WEIGHTS.kiwify_conectada;
  if (steps.performance_ai === "done") score += OPERATION_SCORE_WEIGHTS.performance_ai;
  if (roiPrevisto != null && roiPrevisto > 0) score += OPERATION_SCORE_WEIGHTS.roi_previsto;

  return Math.min(100, Math.max(0, score));
}

export function buildMissingForApproval(
  steps: OperationSteps,
  integrations: { metaConnected: boolean; kiwifyConnected: boolean }
): string[] {
  const missing: string[] = [];
  const checkSteps: OperationStepId[] = [
    "produto",
    "persona",
    "oferta",
    "copy",
    "criativos",
    "landing",
    "meta_ads",
    "performance_ai",
  ];

  for (const stepId of checkSteps) {
    if (steps[stepId] !== "done") {
      const label = OPERATION_PROGRESS_STEPS.find((s) => s.id === stepId)?.label ?? stepId;
      missing.push(label);
    }
  }

  if (!integrations.metaConnected) missing.push("Meta conectada");
  if (!integrations.kiwifyConnected) missing.push("Kiwify conectada");

  return [...new Set(missing)];
}

export function buildOperationNextSteps(
  steps: OperationSteps,
  missing: string[]
): string[] {
  if (missing.length === 0) {
    return ["Revisar operação no Operation Center", "Aprovar operação (modo seguro — sem publicar anúncios)"];
  }

  const next: string[] = [];
  const order: OperationStepId[] = [
    "produto",
    "persona",
    "oferta",
    "copy",
    "criativos",
    "landing",
    "meta_ads",
    "performance_ai",
  ];

  for (const stepId of order) {
    if (steps[stepId] !== "done") {
      const label = OPERATION_PROGRESS_STEPS.find((s) => s.id === stepId)?.label ?? stepId;
      next.push(`Concluir etapa: ${label}`);
      break;
    }
  }

  if (missing.includes("Meta conectada")) next.push("Conectar conta Meta em Integrações");
  if (missing.includes("Kiwify conectada")) next.push("Conectar Kiwify em Integrações");

  return next.slice(0, 5);
}

export function buildOperationProgress(steps: OperationSteps): OperationProgressItem[] {
  return OPERATION_PROGRESS_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    status: steps[step.id],
  }));
}

export function computeOperationCenterDashboard(params: {
  operation: OperationCenter | null;
  bundle: CreatorProductBundle | null;
  metaConnected: boolean;
  kiwifyConnected: boolean;
  hasPerformanceReport: boolean;
}): OperationCenterDashboard {
  const { operation, bundle, metaConnected, kiwifyConnected, hasPerformanceReport } = params;

  if (!operation) {
    return {
      operation: null,
      productName: null,
      progress: OPERATION_PROGRESS_STEPS.map((s) => ({
        id: s.id,
        label: s.label,
        status: "pending" as OperationStepStatus,
      })),
      operationalScore: 0,
      successChance: null,
      nextSteps: ["Gerar estratégia no Aura CEO para iniciar uma operação"],
      missingForApproval: OPERATION_PROGRESS_STEPS.map((s) => s.label),
      canApprove: false,
      safeMode: {
        active: OPERATION_CENTER_SAFE_MODE,
        message:
          "Modo seguro — aprovar operação não publica anúncios automaticamente.",
      },
      integrations: { metaConnected, kiwifyConnected, hasPerformanceReport },
    };
  }

  const steps = computeOperationSteps({
    operation,
    bundle,
    metaConnected,
    kiwifyConnected,
    hasPerformanceReport,
  });

  const roiPrevisto =
    operation.roi_previsto != null ? Number(operation.roi_previsto) : null;

  const operationalScore = computeOperationalScore({
    steps,
    metaConnected,
    kiwifyConnected,
    roiPrevisto,
  });

  const missingForApproval = buildMissingForApproval(steps, {
    metaConnected,
    kiwifyConnected,
  });

  const nextSteps =
    parseOperationNextSteps(operation.next_steps).length > 0
      ? parseOperationNextSteps(operation.next_steps)
      : buildOperationNextSteps(steps, missingForApproval);

  return {
    operation,
    productName: operation.product_nome ?? bundle?.product.nome ?? null,
    progress: buildOperationProgress(steps),
    operationalScore,
    successChance: operation.success_chance,
    nextSteps,
    missingForApproval,
    canApprove:
      missingForApproval.length === 0 &&
      operation.status !== "cancelled" &&
      operation.status !== "ready" &&
      operation.status !== "approved",
    safeMode: {
      active: OPERATION_CENTER_SAFE_MODE,
      message:
        "Modo seguro — aprovar operação altera status para Pronta (ready) sem publicar anúncios.",
    },
    integrations: { metaConnected, kiwifyConnected, hasPerformanceReport },
  };
}

export function buildOperationCenterAuraContext(dashboard: OperationCenterDashboard): string {
  const op = dashboard.operation;
  if (!op) return "Nenhuma operação ativa no Operation Center.";

  const progressLines = dashboard.progress
    .map((p) => `- ${p.label}: ${getOperationStepStatusLabel(p.status)}`)
    .join("\n");

  return [
    "## OPERATION CENTER",
    `Operação: ${op.titulo}`,
    `Status: ${getOperationStatusLabel(op.status)}`,
    `Produto: ${dashboard.productName ?? "—"}`,
    `Score operacional: ${dashboard.operationalScore}/100`,
    dashboard.successChance != null ? `Chance de sucesso: ${dashboard.successChance}%` : null,
    "Progresso:",
    progressLines,
    dashboard.nextSteps.length
      ? `Próximos passos:\n${dashboard.nextSteps.map((s) => `- ${s}`).join("\n")}`
      : null,
    dashboard.missingForApproval.length
      ? `Faltam para aprovar: ${dashboard.missingForApproval.join(", ")}`
      : "Operação pronta para aprovação.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOperationCenterCoachReply(params: {
  mode: OperationCenterCoachMode;
  displayName: string;
  dashboard: OperationCenterDashboard;
  actionResult?: { message: string; error: string | null };
}): string {
  const { mode, displayName, dashboard, actionResult } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;
  const op = dashboard.operation;

  if (!op) {
    return `${firstName}, não há operação ativa no Operation Center. Gere uma estratégia no Aura CEO para iniciar.`;
  }

  if (actionResult) {
    const prefix = actionResult.error
      ? `⚠️ ${actionResult.error}`
      : `✅ ${actionResult.message}`;
    return `${firstName}, ${prefix}\n\n${buildOperationCenterAuraContext(dashboard)}`;
  }

  switch (mode) {
    case "op-missing-approval":
      if (dashboard.missingForApproval.length === 0) {
        return `${firstName}, a operação **${op.titulo}** está completa. Você pode aprovar no Operation Center — modo seguro, sem publicar anúncios.`;
      }
      return `${firstName}, para aprovar **${op.titulo}** ainda falta:\n${dashboard.missingForApproval.map((m) => `• ${m}`).join("\n")}\n\nScore: ${dashboard.operationalScore}/100`;

    case "op-continue":
      return `${firstName}, próximo passo da operação **${op.titulo}**:\n${dashboard.nextSteps.map((s) => `• ${s}`).join("\n")}\n\nAbra o Operation Center para executar.`;

    case "op-generate-creatives":
      return `${firstName}, use **Gerar Criativos** no Operation Center ou peça para continuar a operação. Etapa criativos: ${getOperationStepStatusLabel(dashboard.progress.find((p) => p.id === "criativos")?.status ?? "pending")}.`;

    case "op-prepare-campaign":
      return `${firstName}, use **Montar Campanha** no Operation Center. Etapa Meta Ads: ${getOperationStepStatusLabel(dashboard.progress.find((p) => p.id === "meta_ads")?.status ?? "pending")}. Modo seguro — nada será publicado automaticamente.`;

    case "op-approve":
      if (dashboard.missingForApproval.length > 0) {
        return `${firstName}, não é possível aprovar ainda. Falta: ${dashboard.missingForApproval.join(", ")}.`;
      }
      return `${firstName}, a operação **${op.titulo}** pode ser aprovada. Isso muda o status para **Pronta** — anúncios NÃO serão publicados automaticamente.`;

    case "op-status":
    default:
      return `${firstName}, status da operação:\n\n${buildOperationCenterAuraContext(dashboard)}`;
  }
}

export function appendExecutiveLog(
  logs: OperationExecutiveLogEntry[],
  action: string,
  message: string,
  details?: Record<string, unknown>
): OperationExecutiveLogEntry[] {
  return [
    {
      at: new Date().toISOString(),
      action,
      message,
      details,
    },
    ...logs,
  ].slice(0, 50);
}
