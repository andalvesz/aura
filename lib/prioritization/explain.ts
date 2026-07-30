/**
 * Priority explanation — why / criteria / evidence / limitations / alternatives.
 */

import type {
  PriorityExplanation,
  PriorityItem,
} from "@/lib/prioritization/types/types";

export function explainPriorityPure(item: PriorityItem): PriorityExplanation {
  return {
    priorityId: item.id,
    whyAppeared: item.attentionReason,
    criteriaContributed: item.criteriaContributed,
    evidenceSummaries: item.evidence.map(
      (e) =>
        `[${e.sourceLayer}/${e.sourceType}] ${e.summary} (conf ${e.confidence})`
    ),
    limitations: item.limitations,
    missingData: item.missingData,
    alternativeViews: item.alternativeViews.map(
      (a) => `${a.title}: ${a.summary}`
    ),
    scoreBreakdown: item.scoreBreakdown,
    executionInfluence: "none",
  };
}
