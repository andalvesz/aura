/**
 * Milestone Engine — suggested milestones only; no calendar events.
 */

import { addDaysIso } from "@/lib/planner/scheduling/dates";
import type { PlannerEngine } from "@/lib/planner/types/types";

export const milestoneEngine: PlannerEngine = {
  id: "milestone_v1",
  label: "Milestone",
  description: "Sugere marcos — sem criar eventos de calendário.",
  enrich(draft) {
    if (draft.milestones.length > 0) {
      return {
        ...draft,
        pipelineSteps: [...draft.pipelineSteps, "milestone_skip"],
      };
    }
    const mid = Math.max(0, Math.floor(draft.steps.length / 2) - 1);
    const last = Math.max(0, draft.steps.length - 1);
    const start = draft.startDateSuggested;
    const milestones = [
      {
        title: "Marco intermediário",
        description: "Revisão de meio de caminho (sugerida).",
        targetDateSuggested: start ? addDaysIso(start, 10) : null,
        successCriteria: ["Etapas iniciais revisadas"],
        relatedSteps: draft.steps[mid] ? [`__seq_${mid}`] : [],
        status: "SUGGESTED" as const,
      },
      {
        title: "Marco final",
        description: "Critérios de conclusão revisados pelo usuário.",
        targetDateSuggested: draft.targetDateSuggested ?? null,
        successCriteria: draft.successCriteria.slice(0, 2),
        relatedSteps: draft.steps[last] ? [`__seq_${last}`] : [],
        status: "SUGGESTED" as const,
      },
    ];
    return {
      ...draft,
      milestones,
      pipelineSteps: [...draft.pipelineSteps, "milestone"],
      limitations: [
        ...draft.limitations,
        "Marcos são sugestões — nenhum evento de calendário é criado.",
      ],
    };
  },
};
