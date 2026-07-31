/**
 * Dependency Engine — flags dependency concerns into limitations (issues added later).
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const dependencyEngine: PlannerEngine = {
  id: "dependency_v1",
  label: "Dependency",
  description: "Marca dependências e lacunas — nunca corrige silenciosamente.",
  enrich(draft, context) {
    const limitations = [...draft.limitations];
    if (context.dataCompleteness.gaps.includes("no_projects")) {
      limitations.push("Sem projeto vinculado — dependências de projeto desconhecidas.");
    }
    if (context.dataCompleteness.gaps.includes("no_missions")) {
      limitations.push("Sem missão vinculada — prazo de missão desconhecido.");
    }
    return {
      ...draft,
      limitations,
      alternatives: [
        ...draft.alternatives,
        "Quebrar o plano em dois planos menores se dependências forem complexas",
      ],
      pipelineSteps: [...draft.pipelineSteps, "dependency_scan"],
    };
  },
};
