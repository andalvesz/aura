/**
 * Prioritization validator — items without required fields are rejected.
 * Requires: evidence, limitations, confidence, score (priorityScore).
 * executionInfluence must be "none".
 */

import type {
  PriorityEngineCandidate,
  PriorityItem,
} from "@/lib/prioritization/types/types";

export type PriorityValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validatePriorityCandidate(
  candidate: PriorityEngineCandidate | PriorityItem
): PriorityValidationResult {
  const errors: string[] = [];

  if (!candidate.title?.trim()) errors.push("missing_title");
  if (!candidate.summary?.trim()) errors.push("missing_summary");
  if (!candidate.evidence?.length) errors.push("missing_evidence");
  if (typeof candidate.confidence !== "number") errors.push("missing_confidence");
  if (typeof candidate.priorityScore !== "number") errors.push("missing_score");
  if (!candidate.scoreBreakdown) errors.push("missing_score_breakdown");
  if (!candidate.limitations?.length) errors.push("missing_limitations");
  if (!candidate.alternativeViews?.length) {
    errors.push("missing_alternativeViews");
  }
  if (!candidate.attentionReason?.trim()) errors.push("missing_attentionReason");
  if (candidate.executionInfluence !== "none") {
    errors.push("executionInfluence_must_be_none");
  }
  if (!candidate.explanation?.trim()) errors.push("missing_explanation");
  if (!candidate.criteriaContributed?.length) {
    errors.push("missing_criteriaContributed");
  }

  return { ok: errors.length === 0, errors };
}

export function filterValidPriorityCandidates<T extends PriorityEngineCandidate>(
  candidates: T[]
): { valid: T[]; rejected: Array<{ candidate: T; errors: string[] }> } {
  const valid: T[] = [];
  const rejected: Array<{ candidate: T; errors: string[] }> = [];
  for (const c of candidates) {
    const result = validatePriorityCandidate(c);
    if (result.ok) valid.push(c);
    else rejected.push({ candidate: c, errors: result.errors });
  }
  return { valid, rejected };
}
