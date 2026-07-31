/**
 * Recommendation explanation — full pipeline for explainability UI.
 */

import type {
  RecommendationCard,
  RecommendationExplanation,
} from "@/lib/recommendation/types/types";

export function explainRecommendationPure(
  item: RecommendationCard
): RecommendationExplanation {
  return {
    recommendationId: item.id,
    whyAppeared: item.reasoning.whyAppeared,
    criteriaWeighted: item.reasoning.criteriaWeighted,
    evidenceSummaries: item.evidence.map(
      (e) =>
        `[${e.sourceLayer}/${e.sourceType}] ${e.summary} (conf ${e.confidence})`
    ),
    limitations: item.limitations,
    missingInformation: item.reasoning.missingInformation.length
      ? item.reasoning.missingInformation
      : item.missingData,
    alternatives: item.alternatives.map((a) => `${a.title}: ${a.summary}`),
    scoreBreakdown: item.scoreBreakdown,
    pipelineSteps: item.pipelineSteps,
    conflicts: item.conflicts,
    executionInfluence: "none",
  };
}
