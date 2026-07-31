/**
 * Relationship Recommendation — suggests people/entities worth attention.
 * Never sends messages or alters CRM.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const relationshipRecommender: RecommendationEngine = {
  id: "relationship_recommender_v1",
  recommendationType: "RELATIONSHIP",
  label: "Recomendador de relacionamentos",
  description:
    "Sugere entidades/pessoas relevantes no World Model — sem contactar.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const people = context.sources.worldEntities
      .filter((e) =>
        ["person", "contact", "client", "partner", "organization"].includes(
          (e.entityType ?? "").toLowerCase()
        )
      )
      .slice(0, max);

    const entities =
      people.length > 0
        ? people
        : context.sources.worldEntities.slice(0, max);

    return entities.map((e, index) => {
      const memory = context.sources.memories[index] ?? context.sources.memories[0];
      const business = context.sources.businesses[0];
      const why = `Entidade "${e.name}" no World Model (#${index + 1}) — sugerir atenção relacional, sem contactar.`;
      const evidence = [
        makeEvidence({
          evidenceType: "world_entity",
          sourceLayer: "world",
          sourceType: e.entityType ?? "entity",
          sourceId: e.id,
          summary: e.summary || e.name,
          confidence: 55,
        }),
        ...(memory
          ? [
              makeEvidence({
                evidenceType: "memory_link",
                sourceLayer: "memory" as const,
                sourceType: "memory",
                sourceId: memory.id,
                summary: memory.title,
                confidence: memory.confidence ?? 50,
              }),
            ]
          : []),
        ...(business
          ? [
              makeEvidence({
                evidenceType: "business_context",
                sourceLayer: "business" as const,
                sourceType: "business",
                sourceId: business.id,
                summary: business.name,
                confidence: 45,
              }),
            ]
          : []),
      ];
      const alternatives = [
        {
          id: "defer_contact",
          title: "Adiar contato",
          summary: "Manter no radar sem ação esta semana.",
        },
        {
          id: "focus_project",
          title: "Focar projeto",
          summary: "Priorizar trabalho de projeto antes de relacionamento.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "relationship_recommender_v1",
        recommendationType: "RELATIONSHIP",
        title: `Relacionamento: ${e.name}`,
        summary:
          e.summary ||
          `Considerar o relacionamento com ${e.name} — sem enviar mensagens.`,
        confidence: 55,
        impact: "MEDIUM",
        urgency: "LOW",
        effort: "LOW",
        reversibility: "HIGH",
        evidence,
        limitations: [
          "Não envia mensagens nem agenda reuniões.",
          "Não altera CRM nem World Model.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: why,
          criteriaWeighted: ["world", "memory", "business"],
          evidenceUsed: evidence.map((ev) => ev.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Relationship Recommender sugere atenção a relacionamentos. Nunca contacta.",
        criteriaContributed: ["completeness", "confidence"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("relationship_recommender_v1", [e.id]),
        relatedEntityIds: [e.id],
        relatedMemoryIds: memory ? [memory.id] : [],
        relatedBusinessIds: business ? [business.id] : [],
        signalObservedAt: null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_world",
          "read_memory",
          "read_business",
          "score_relationship",
          "attach_reasoning",
        ],
      });
    });
  },
};
