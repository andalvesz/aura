/**
 * Decision explanation — why / evidence / limitations.
 */

import type {
  DecisionCard,
  DecisionExplanation,
} from "@/lib/decision-support/types/types";

export function explainDecisionPure(card: DecisionCard): DecisionExplanation {
  return {
    decisionId: card.id,
    whyAppeared: card.whyAppeared,
    evidenceSummaries: card.evidence.map(
      (e) =>
        `[${e.sourceLayer}/${e.sourceType}] ${e.summary} (conf ${e.confidence})`
    ),
    limitations: card.limitations,
    alternatives: card.alternativeOptions.map(
      (a) => `${a.title}: ${a.summary}`
    ),
    executionInfluence: "none",
  };
}
