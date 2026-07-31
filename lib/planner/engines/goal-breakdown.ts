/**
 * Goal Breakdown Engine — turns source into objective + initial steps.
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const goalBreakdownEngine: PlannerEngine = {
  id: "goal_breakdown_v1",
  label: "Goal Breakdown",
  description: "Quebra objetivo em etapas iniciais — sem executar.",
  enrich(draft, context) {
    if (draft.steps.length >= 3) {
      return {
        ...draft,
        pipelineSteps: [...draft.pipelineSteps, "goal_breakdown_skip"],
      };
    }

    const rec = context.sources.recommendations[0];
    const project = context.sources.projects[0];
    const extra = [
      {
        title: "Coletar evidências",
        description: rec
          ? `Revisar evidências de: ${rec.title}`
          : "Reunir contexto disponível.",
        order: draft.steps.length,
        status: "DRAFT" as const,
        stepType: "RESEARCH" as const,
        ownerId: null,
        dependsOn: [] as string[],
        suggestedStart: null,
        suggestedDeadline: null,
        estimatedEffort: "MEDIUM" as const,
        requiredResources: [] as string[],
        successCriteria: ["Evidências listadas"],
        riskLevel: "LOW" as const,
        requiresConfirmation: true,
      },
      {
        title: project
          ? `Alinhar com projeto ${project.name}`
          : "Definir escopo",
        description: "Confirmar fronteiras do plano.",
        order: draft.steps.length + 1,
        status: "DRAFT" as const,
        stepType: "DECIDE" as const,
        ownerId: null,
        dependsOn: [] as string[],
        suggestedStart: null,
        suggestedDeadline: null,
        estimatedEffort: "LOW" as const,
        requiredResources: [] as string[],
        successCriteria: ["Escopo escrito"],
        riskLevel: "LOW" as const,
        requiresConfirmation: true,
      },
    ];

    return {
      ...draft,
      steps: [...draft.steps, ...extra],
      successCriteria:
        draft.successCriteria.length > 0
          ? draft.successCriteria
          : ["Objetivo atingido com revisão humana"],
      pipelineSteps: [...draft.pipelineSteps, "goal_breakdown"],
    };
  },
};
