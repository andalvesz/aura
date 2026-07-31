/**
 * Resource Planning Engine.
 */

import type { PlannerEngine } from "@/lib/planner/types/types";

export const resourcePlanningEngine: PlannerEngine = {
  id: "resource_planning_v1",
  label: "Resource Planning",
  description: "Mapeia recursos necessários — sem reservar.",
  enrich(draft, context) {
    const resources = [...draft.resources];
    if (context.sources.knowledgeDocuments[0]) {
      const doc = context.sources.knowledgeDocuments[0];
      resources.push({
        title: doc.title,
        description: "Documento de conhecimento (somente leitura)",
        kind: "document",
        availability: "AVAILABLE",
        relatedStepIds: [],
      });
    } else {
      resources.push({
        title: "Documento de referência",
        description: "Ainda não identificado no Knowledge Hub",
        kind: "document",
        availability: "UNKNOWN",
        relatedStepIds: [],
      });
    }
    if (context.sources.worldEntities[0]) {
      const e = context.sources.worldEntities[0];
      resources.push({
        title: e.name,
        description: e.entityType ?? "pessoa/entidade",
        kind: "person",
        availability: "PARTIAL",
        relatedStepIds: [],
      });
    }
    resources.push({
      title: "Tempo de revisão",
      description: "Tempo humano para aprovação",
      kind: "time",
      availability: "UNKNOWN",
      relatedStepIds: [],
    });

    return {
      ...draft,
      resources,
      pipelineSteps: [...draft.pipelineSteps, "resource_planning"],
    };
  },
};
