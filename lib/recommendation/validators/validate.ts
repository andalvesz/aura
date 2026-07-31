/**
 * Recommendation validator — items without required fields are rejected.
 * Requires: evidence, confidence, limitations, alternatives, reasoning.
 * executionInfluence must be "none".
 */

import type {
  RecommendationEngineCandidate,
  RecommendationCard,
} from "@/lib/recommendation/types/types";

export type RecommendationValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateRecommendationCandidate(
  candidate: RecommendationEngineCandidate | RecommendationCard
): RecommendationValidationResult {
  const errors: string[] = [];

  if (!candidate.title?.trim()) errors.push("missing_title");
  if (!candidate.summary?.trim()) errors.push("missing_summary");
  if (!candidate.evidence?.length) errors.push("missing_evidence");
  if (typeof candidate.confidence !== "number") errors.push("missing_confidence");
  if (typeof candidate.priorityScore !== "number") errors.push("missing_score");
  if (!candidate.scoreBreakdown) errors.push("missing_score_breakdown");
  if (!candidate.limitations?.length) errors.push("missing_limitations");
  if (!candidate.alternatives?.length) errors.push("missing_alternatives");
  if (!candidate.reasoning) errors.push("missing_reasoning");
  else {
    if (!candidate.reasoning.whyAppeared?.trim()) {
      errors.push("missing_reasoning.whyAppeared");
    }
    if (!candidate.reasoning.criteriaWeighted?.length) {
      errors.push("missing_reasoning.criteriaWeighted");
    }
    if (!candidate.reasoning.evidenceUsed?.length) {
      errors.push("missing_reasoning.evidenceUsed");
    }
    if (!candidate.reasoning.alternativesConsidered?.length) {
      errors.push("missing_reasoning.alternativesConsidered");
    }
  }
  if (candidate.executionInfluence !== "none") {
    errors.push("executionInfluence_must_be_none");
  }
  if (!candidate.explanation?.trim()) errors.push("missing_explanation");
  if (!candidate.criteriaContributed?.length) {
    errors.push("missing_criteriaContributed");
  }

  return { ok: errors.length === 0, errors };
}

export function filterValidRecommendationCandidates<
  T extends RecommendationEngineCandidate,
>(
  candidates: T[]
): { valid: T[]; rejected: Array<{ candidate: T; errors: string[] }> } {
  const valid: T[] = [];
  const rejected: Array<{ candidate: T; errors: string[] }> = [];
  for (const c of candidates) {
    const result = validateRecommendationCandidate(c);
    if (result.ok) valid.push(c);
    else rejected.push({ candidate: c, errors: result.errors });
  }
  return { valid, rejected };
}
