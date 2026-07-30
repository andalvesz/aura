/**
 * Ranking — impact, urgency, confidence, effort, reversibility.
 */

import {
  LEVEL_SCORE,
  REVERSIBILITY_SCORE,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionCard } from "@/lib/decision-support/types/types";

export function decisionRankScore(card: DecisionCard): number {
  const impact = LEVEL_SCORE[card.impact] * 20;
  const urgency = LEVEL_SCORE[card.urgency] * 18;
  const confidence = card.confidence * 0.35;
  /** Lower effort scores higher (easier first) */
  const effort = (4 - LEVEL_SCORE[card.effort]) * 8;
  const reversibility = REVERSIBILITY_SCORE[card.reversibility] * 6;
  return impact + urgency + confidence + effort + reversibility;
}

export function rankDecisionCards(cards: DecisionCard[]): DecisionCard[] {
  return [...cards].sort((a, b) => {
    const diff = decisionRankScore(b) - decisionRankScore(a);
    if (diff !== 0) return diff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
