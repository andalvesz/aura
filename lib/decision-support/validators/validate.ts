/**
 * Decision Support validator — cards without required fields are rejected.
 */

import type {
  DecisionCard,
  DecisionEngineCandidate,
} from "@/lib/decision-support/types/types";

export type DecisionValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateDecisionCandidate(
  candidate: DecisionEngineCandidate | DecisionCard
): DecisionValidationResult {
  const errors: string[] = [];

  if (!candidate.title?.trim()) errors.push("missing_title");
  if (!candidate.summary?.trim()) errors.push("missing_summary");
  if (!candidate.evidence?.length) errors.push("missing_evidence");
  if (typeof candidate.confidence !== "number") errors.push("missing_confidence");
  if (!candidate.limitations?.length) errors.push("missing_limitations");
  if (!candidate.alternativeOptions?.length) {
    errors.push("missing_alternativeOptions");
  }
  if (candidate.executionInfluence !== "none") {
    errors.push("executionInfluence_must_be_none");
  }
  if (!candidate.whyAppeared?.trim()) errors.push("missing_whyAppeared");
  if (!candidate.explanation?.trim()) errors.push("missing_explanation");

  return { ok: errors.length === 0, errors };
}

export function filterValidCandidates<T extends DecisionEngineCandidate>(
  candidates: T[]
): { valid: T[]; rejected: Array<{ candidate: T; errors: string[] }> } {
  const valid: T[] = [];
  const rejected: Array<{ candidate: T; errors: string[] }> = [];
  for (const c of candidates) {
    const result = validateDecisionCandidate(c);
    if (result.ok) valid.push(c);
    else rejected.push({ candidate: c, errors: result.errors });
  }
  return { valid, rejected };
}
