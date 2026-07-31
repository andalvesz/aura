/**
 * Transparent recommendation score — documented weights, never invented by AI.
 *
 * SCORE_WEIGHTS:
 * | Critério        | Fórmula                         |
 * | impact          | LEVEL(1–3) × 20                 |
 * | urgency         | LEVEL(1–3) × 18                 |
 * | confidence      | confidence(0–100) × 0.35        |
 * | effort          | (4 − LEVEL) × 8                 |
 * | reversibility   | REV(HIGH=3…LOW=1) × 6           |
 * | recency         | recencyFactor(0–1) × 10         |
 * | completeness    | completenessScore(0–100) × 0.15 |
 */

import type {
  EffortLevel,
  ImpactLevel,
  RecommendationCard,
  RecommendationScoreBreakdown,
  ReversibilityLevel,
  UrgencyLevel,
} from "@/lib/recommendation/types/types";

export const SCORE_WEIGHTS = {
  impact: 20,
  urgency: 18,
  confidence: 0.35,
  effort: 8,
  reversibility: 6,
  recency: 10,
  completeness: 0.15,
} as const;

export const LEVEL_SCORE: Record<"LOW" | "MEDIUM" | "HIGH", number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export const REVERSIBILITY_SCORE: Record<ReversibilityLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function recencyFactor(observedAt: string | null | undefined): number {
  if (!observedAt) return 0.35;
  const ageMs = Date.now() - new Date(observedAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return 0.35;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays <= 7) return 1;
  if (ageDays >= 90) return 0;
  return Math.max(0, 1 - (ageDays - 7) / 83);
}

export function computeRecommendationScore(input: {
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  confidence: number;
  effort: EffortLevel;
  reversibility: ReversibilityLevel;
  signalObservedAt?: string | null;
  completenessScore?: number;
}): RecommendationScoreBreakdown {
  const impact = LEVEL_SCORE[input.impact] * SCORE_WEIGHTS.impact;
  const urgency = LEVEL_SCORE[input.urgency] * SCORE_WEIGHTS.urgency;
  const confidence =
    Math.max(0, Math.min(100, input.confidence)) * SCORE_WEIGHTS.confidence;
  const effort = (4 - LEVEL_SCORE[input.effort]) * SCORE_WEIGHTS.effort;
  const reversibility =
    REVERSIBILITY_SCORE[input.reversibility] * SCORE_WEIGHTS.reversibility;
  const recency =
    recencyFactor(input.signalObservedAt) * SCORE_WEIGHTS.recency;
  const completeness =
    Math.max(0, Math.min(100, input.completenessScore ?? 50)) *
    SCORE_WEIGHTS.completeness;

  const total =
    Math.round(
      (impact +
        urgency +
        confidence +
        effort +
        reversibility +
        recency +
        completeness) *
        100
    ) / 100;

  return {
    impact,
    urgency,
    confidence: Math.round(confidence * 100) / 100,
    effort,
    reversibility,
    recency: Math.round(recency * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    total,
  };
}

export function rankRecommendationItems(
  items: RecommendationCard[]
): RecommendationCard[] {
  const sorted = [...items].sort((a, b) => {
    const diff = b.priorityScore - a.priorityScore;
    if (diff !== 0) return diff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return sorted.map((item, index) => ({
    ...item,
    ranking: index + 1,
  }));
}
