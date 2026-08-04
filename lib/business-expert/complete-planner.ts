/**
 * Complete business plan drafts for the core Planner (not a parallel planner).
 */

import type {
  BusinessContext,
  BusinessIntentKind,
  BusinessModeId,
  BusinessPlanDraft,
} from "@/lib/business-expert/types";
import type { PlanDraftProposal, PlanStepType } from "@/lib/planner/types/types";

export function draftCompleteBusinessPlan(input: {
  intent: BusinessIntentKind;
  title: string;
  objective: string;
  mode?: BusinessModeId | null;
  context?: BusinessContext | null;
  checklist?: string[];
  milestones?: Array<{ title: string; criteria: string }>;
  kpis?: Array<{ name: string; target: string }>;
}): BusinessPlanDraft {
  const checklist = input.checklist ?? [
    "Clarear objetivo e métrica de sucesso",
    "Mapear cliente e oferta",
    "Validar com evidência real",
    "Definir canal e preço",
    "Revisar no Plan Center",
  ];
  const milestones = input.milestones ?? [
    { title: "Clareza", criteria: "Objetivo escrito" },
    { title: "Prova", criteria: "Evidência coletada" },
    { title: "Tração", criteria: "Primeira receita ou compromisso" },
  ];
  const kpis = input.kpis ?? [
    { name: "Progresso semanal", target: "≥ 1 marco" },
    { name: "Aprendizados registrados", target: "≥ 3" },
  ];

  const steps = [
    {
      order: 0,
      title: "Clarear objetivo empresarial",
      description: input.objective,
      domain: "validacao" as const,
      successCriteria: ["Objetivo e métrica definidos"],
    },
    {
      order: 1,
      title: "Desenhar oferta e posicionamento",
      description: "Promessa, público, prova e preço.",
      domain: "oferta" as const,
      successCriteria: ["Oferta em 1 parágrafo"],
    },
    {
      order: 2,
      title: "Validar no mundo real",
      description: "Conversas, pré-venda ou teste de canal.",
      domain: "validacao" as const,
      successCriteria: ["Critério go/no-go preenchido"],
    },
    {
      order: 3,
      title: "Operar e medir",
      description: "Checklist semanal + KPIs.",
      domain: "operacao" as const,
      successCriteria: ["KPIs revisados"],
    },
    {
      order: 4,
      title: "Revisão no core Planner",
      description: "Aprovar rascunho — sem execução automática.",
      domain: null,
      successCriteria: ["Plano revisado"],
    },
  ];

  return {
    title: input.title,
    objective: input.objective,
    summary: `Business Expert ${input.intent}${input.mode ? ` · modo ${input.mode}` : ""}${input.context ? ` · user ${input.context.userId}` : ""}`,
    assumptions: [
      "Usuário revisa no core Planner",
      "Sem inventar dados de mercado recentes",
      "Jurídico/impostos são orientação — profissionais externos quando necessário",
    ],
    limitations: [
      "Não executa ações",
      "Não cria automações silenciosas",
      "Não substitui o core Planner",
      "B1.X usa knowledge interno + web research provider quando configurado",
    ],
    successCriteria: milestones.map((m) => m.criteria),
    steps,
    checklist,
    milestones,
    kpis,
    projectOutline: {
      name: input.title.replace(/^Plano[:\s]*/i, "Projeto: "),
      description: input.objective,
    },
    missionOutline: {
      name: `Missão: ${input.intent}`,
      description: input.objective,
    },
    pipelineSteps: ["business_expert_b1x", "complete_plan", "manual_seed"],
    sourceKind: "business_expert",
    confidence: input.context && input.context.gaps.length > 3 ? 50 : 72,
    forCorePlanner: true,
  };
}

export function toCorePlanDraftProposal(draft: BusinessPlanDraft): PlanDraftProposal {
  return {
    title: draft.title,
    summary: draft.summary,
    objective: draft.objective,
    assumptions: draft.assumptions,
    limitations: draft.limitations,
    successCriteria: draft.successCriteria,
    estimatedEffort: "MEDIUM",
    riskLevel: draft.confidence < 55 ? "MEDIUM" : "LOW",
    confidence: draft.confidence,
    steps: draft.steps.map((s) => ({
      title: s.title,
      description: s.description,
      order: s.order,
      status: "DRAFT" as const,
      stepType: (s.order === 0
        ? "DECIDE"
        : s.order === draft.steps.length - 1
          ? "REVIEW"
          : "PREPARE") as PlanStepType,
      ownerId: null,
      dependsOn: [],
      suggestedStart: null,
      suggestedDeadline: null,
      estimatedEffort: "MEDIUM" as const,
      requiredResources: s.domain ? [`domain:${s.domain}`] : [],
      successCriteria: s.successCriteria,
      riskLevel: "LOW" as const,
      requiresConfirmation: true,
    })),
    milestones: draft.milestones.map((m) => ({
      title: m.title,
      description: m.criteria,
      targetDateSuggested: null,
      successCriteria: [m.criteria],
      relatedSteps: [],
      status: "SUGGESTED" as const,
    })),
    resources: draft.kpis.map((k) => ({
      kind: "knowledge" as const,
      title: `KPI: ${k.name}`,
      description: k.target,
      availability: "PARTIAL" as const,
      relatedStepIds: [],
    })),
    risks: [],
    alternatives: ["Manter só no Business Expert sem seed no Planner"],
    pipelineSteps: draft.pipelineSteps,
    sourceKind: "manual",
    sourceId: null,
  };
}

/** Keep B1.0 API name as alias. */
export { draftCompleteBusinessPlan as draftBusinessPlan };
