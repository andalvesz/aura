/**
 * Opportunity Recommendation — suggests opportunities worth considering.
 * Never captures or executes.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
  LEVEL_SCORE,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const opportunityRecommender: RecommendationEngine = {
  id: "opportunity_recommender_v1",
  recommendationType: "OPPORTUNITY",
  label: "Recomendador de oportunidades",
  description:
    "Sugere oportunidades que fazem sentido no contexto — sem capturá-las.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const opps = context.sources.discoveries
      .filter(
        (d) =>
          ["OPPORTUNITY", "GAP", "TREND"].includes(d.type) &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => ({
        d,
        score:
          d.confidence * 0.4 +
          LEVEL_SCORE[parseLevel(d.impact)] * 15 +
          LEVEL_SCORE[parseLevel(d.urgency)] * 8,
      }))
      .sort((a, b) => b.score - a.score);

    const priority = context.sources.priorities.find(
      (p) =>
        ["OPPORTUNITY", "IMPACT"].includes(p.kind) &&
        !["IGNORED", "ARCHIVED"].includes(p.status ?? "")
    );
    const decision = context.sources.decisions.find(
      (d) => !["REJECTED", "ARCHIVED"].includes(d.status ?? "")
    );
    const scenario = context.sources.scenarios.find(
      (s) =>
        !["ARCHIVED", "DISCARDED"].includes(s.status ?? "") &&
        (s.impact === "HIGH" || s.confidence >= 55)
    );

    return opps.slice(0, max).map(({ d }, index) => {
      const project = context.sources.projects.find((p) =>
        ["active", "idea", "planning"].includes(p.status)
      );
      const why = `Oportunidade #${index + 1} alinhada a discovery + priorização — considerar, não executar.`;
      const evidence = [
        makeEvidence({
          evidenceType: "opportunity_signal",
          sourceLayer: "discovery",
          sourceType: d.type,
          sourceId: d.id,
          summary: d.summary || d.title,
          confidence: d.confidence,
        }),
        ...(priority
          ? [
              makeEvidence({
                evidenceType: "priority_support",
                sourceLayer: "prioritization" as const,
                sourceType: priority.kind,
                sourceId: priority.id,
                summary: priority.title,
                confidence: priority.confidence,
              }),
            ]
          : []),
        ...(scenario
          ? [
              makeEvidence({
                evidenceType: "scenario_support",
                sourceLayer: "scenario" as const,
                sourceType: "scenario",
                sourceId: scenario.id,
                summary: scenario.title,
                confidence: scenario.confidence,
              }),
            ]
          : []),
      ];
      const alternatives = [
        {
          id: "alt_risk_first",
          title: "Olhar riscos primeiro",
          summary: "Pode haver riscos que mereçam atenção antes desta oportunidade.",
        },
        {
          id: "alt_park",
          title: "Estacionar",
          summary: "Manter no radar sem priorizar esta semana.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "opportunity_recommender_v1",
        recommendationType: "OPPORTUNITY",
        title: `Recomendação: ${d.title}`,
        summary:
          d.summary ||
          "Oportunidade sugerida para consideração humana — sem captura automática.",
        confidence: d.confidence,
        impact: parseLevel(d.impact, "HIGH"),
        urgency: parseLevel(d.urgency, "MEDIUM"),
        effort: "MEDIUM",
        reversibility: "HIGH",
        evidence,
        limitations: [
          "Não captura oportunidades automaticamente.",
          "Não cria projetos, tarefas nem missões.",
          "Não altera Planner.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: why,
          criteriaWeighted: ["impact", "confidence", "reversibility"],
          evidenceUsed: evidence.map((e) => e.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Opportunity Recommender sugere atenção a oportunidades. Nunca executa captura.",
        criteriaContributed: ["impact", "confidence", "reversibility"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("opportunity_recommender_v1", [d.id]),
        relatedDiscovery: d.id,
        relatedProject: project?.id ?? null,
        relatedScenario: scenario?.id ?? null,
        relatedPriority: priority?.id ?? null,
        relatedDecision: decision?.id ?? null,
        relatedBusinessIds: context.sources.businesses.slice(0, 1).map((b) => b.id),
        signalObservedAt: d.updatedAt ?? null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_discovery",
          "read_prioritization",
          "read_scenario",
          "score_opportunity",
          "attach_reasoning",
        ],
      });
    });
  },
};
