/**
 * Lightweight plan templates for manual / seed breakdowns.
 */

import type { PlanDraftProposal, PlanStepType } from "@/lib/planner/types/types";

export function baseManualDraft(input: {
  title: string;
  objective: string;
  summary?: string;
}): PlanDraftProposal {
  const steps: PlanDraftProposal["steps"] = [
    {
      title: "Clarificar objetivo",
      description: "Confirmar o que sucesso significa.",
      order: 0,
      status: "DRAFT",
      stepType: "DECIDE" as PlanStepType,
      ownerId: null,
      dependsOn: [],
      suggestedStart: null,
      suggestedDeadline: null,
      estimatedEffort: "LOW",
      requiredResources: [],
      successCriteria: ["Objetivo escrito e acordado"],
      riskLevel: "LOW",
      requiresConfirmation: true,
    },
    {
      title: "Mapear etapas",
      description: "Listar passos manuais necessários.",
      order: 1,
      status: "DRAFT",
      stepType: "PREPARE",
      ownerId: null,
      dependsOn: [],
      suggestedStart: null,
      suggestedDeadline: null,
      estimatedEffort: "MEDIUM",
      requiredResources: [],
      successCriteria: ["Lista de etapas revisada"],
      riskLevel: "LOW",
      requiresConfirmation: true,
    },
    {
      title: "Revisão humana",
      description: "Aprovar ou ajustar o plano antes de qualquer ação.",
      order: 2,
      status: "DRAFT",
      stepType: "REVIEW",
      ownerId: null,
      dependsOn: [],
      suggestedStart: null,
      suggestedDeadline: null,
      estimatedEffort: "LOW",
      requiredResources: [],
      successCriteria: ["Plano aprovado explicitamente"],
      riskLevel: "LOW",
      requiresConfirmation: true,
    },
  ];

  return {
    title: input.title,
    summary: input.summary ?? input.objective,
    objective: input.objective,
    assumptions: ["O usuário revisará antes de qualquer execução externa."],
    limitations: [
      "Este plano não executa ações.",
      "Não cria tarefas operacionais automaticamente.",
      "Não altera calendário.",
    ],
    successCriteria: ["Plano revisado e aprovado pelo usuário"],
    estimatedEffort: "MEDIUM",
    riskLevel: "LOW",
    confidence: 50,
    steps,
    milestones: [],
    resources: [],
    risks: [],
    alternatives: ["Manter como rascunho sem aprovação"],
    pipelineSteps: ["manual_seed"],
    sourceKind: "manual",
    sourceId: null,
  };
}
