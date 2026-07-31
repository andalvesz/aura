/**
 * Review Cadence Engine — suggests human review steps.
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const reviewCadenceEngine: PlannerEngine = {
  id: "review_cadence_v1",
  label: "Review Cadence",
  description: "Garante etapa de revisão humana antes de aprovação.",
  enrich(draft) {
    const hasReview = draft.steps.some((s) => s.stepType === "REVIEW");
    if (hasReview) {
      return {
        ...draft,
        pipelineSteps: [...draft.pipelineSteps, "review_cadence_ok"],
      };
    }
    return {
      ...draft,
      steps: [
        ...draft.steps,
        {
          title: "Revisão e aprovação humana",
          description:
            "Obrigatório: revisar plano, riscos e dependências antes de qualquer ação.",
          order: draft.steps.length,
          status: "DRAFT",
          stepType: "REVIEW",
          ownerId: null,
          dependsOn: draft.steps.length
            ? [`__seq_${draft.steps.length - 1}`]
            : [],
          suggestedStart: null,
          suggestedDeadline: null,
          estimatedEffort: "LOW",
          requiredResources: [],
          successCriteria: ["Aprovação explícita registrada"],
          riskLevel: "LOW",
          requiresConfirmation: true,
        },
      ],
      pipelineSteps: [...draft.pipelineSteps, "review_cadence"],
    };
  },
};
