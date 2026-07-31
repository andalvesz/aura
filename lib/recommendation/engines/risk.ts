/**
 * Risk Recommendation — suggests risks worth human attention.
 * Never mitigates.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
  LEVEL_SCORE,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const riskRecommender: RecommendationEngine = {
  id: "risk_recommender_v1",
  recommendationType: "RISK",
  label: "Recomendador de riscos",
  description: "Sugere riscos para atenção humana — sem mitigar.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const risks = context.sources.discoveries
      .filter(
        (d) =>
          ["RISK", "DEPENDENCY", "STAGNATION", "CONFLICT"].includes(d.type) &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => ({
        d,
        score:
          d.confidence * 0.45 +
          LEVEL_SCORE[parseLevel(d.impact, "HIGH")] * 18 +
          LEVEL_SCORE[parseLevel(d.urgency, "HIGH")] * 12,
      }))
      .sort((a, b) => b.score - a.score);

    const priority = context.sources.priorities.find(
      (p) =>
        p.kind === "RISK" && !["IGNORED", "ARCHIVED"].includes(p.status ?? "")
    );

    return risks.slice(0, max).map(({ d }, index) => {
      const why = `Risco #${index + 1} por impacto×urgência×confiança — recomendar atenção, não mitigar.`;
      const evidence = [
        makeEvidence({
          evidenceType: "risk_signal",
          sourceLayer: "discovery",
          sourceType: d.type,
          sourceId: d.id,
          summary: d.summary || d.title,
          confidence: d.confidence,
        }),
        ...context.sources.worldEntities.slice(0, 1).map((e) =>
          makeEvidence({
            evidenceType: "world_entity",
            sourceLayer: "world",
            sourceType: e.entityType ?? "entity",
            sourceId: e.id,
            summary: e.name,
            confidence: 50,
          })
        ),
        ...(priority
          ? [
              makeEvidence({
                evidenceType: "priority_risk",
                sourceLayer: "prioritization" as const,
                sourceType: priority.kind,
                sourceId: priority.id,
                summary: priority.title,
                confidence: priority.confidence,
              }),
            ]
          : []),
      ];
      const alternatives = [
        {
          id: "monitor",
          title: "Monitorar",
          summary: "Acompanhar sem ação imediata.",
        },
        {
          id: "opportunity_first",
          title: "Priorizar oportunidade",
          summary: "Se o upside for maior, olhar oportunidade antes.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "risk_recommender_v1",
        recommendationType: "RISK",
        title: `Recomendação de risco: ${d.title}`,
        summary:
          d.summary ||
          "Risco sugerido para atenção — sem mitigação automática.",
        confidence: d.confidence,
        impact: parseLevel(d.impact, "HIGH"),
        urgency: parseLevel(d.urgency, "HIGH"),
        effort: "MEDIUM",
        reversibility: "LOW",
        evidence,
        limitations: [
          "Não mitiga riscos automaticamente.",
          "Não cria alertas de execução nem altera projetos.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: why,
          criteriaWeighted: ["impact", "urgency", "confidence"],
          evidenceUsed: evidence.map((e) => e.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Risk Recommender sugere atenção a riscos. Nunca mitiga nem cria automações.",
        criteriaContributed: ["impact", "urgency", "confidence"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("risk_recommender_v1", [d.id]),
        relatedDiscovery: d.id,
        relatedPriority: priority?.id ?? null,
        relatedProject:
          context.sources.projects.find((p) => p.status === "active")?.id ??
          null,
        relatedEntityIds: context.sources.worldEntities.slice(0, 1).map((e) => e.id),
        signalObservedAt: d.updatedAt ?? null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_discovery_risks",
          "read_world",
          "read_prioritization",
          "score_risk",
          "attach_reasoning",
        ],
      });
    });
  },
};
