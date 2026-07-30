/**
 * Scenario explanation.
 */

import type {
  ScenarioCard,
  ScenarioExplanation,
} from "@/lib/scenario/types/types";

export function explainScenarioPure(card: ScenarioCard): ScenarioExplanation {
  return {
    scenarioId: card.id,
    usedData: card.evidence
      .filter((e) => e.used)
      .map((e) => `[${e.sourceLayer}/${e.sourceType}] ${e.summary}`),
    ignoredData: card.ignoredData,
    whyResult: card.whyResult,
    assumptions: card.assumptions.map((a) => a.statement),
    limitations: card.limitations,
    executionInfluence: "none",
  };
}
