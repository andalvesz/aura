/**
 * Scenario validator — assumptions, limitations, confidence, evidence required.
 */

import type {
  ScenarioCard,
  ScenarioEngineCandidate,
} from "@/lib/scenario/types/types";

export type ScenarioValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validateScenarioCandidate(
  candidate: ScenarioEngineCandidate | ScenarioCard
): ScenarioValidationResult {
  const errors: string[] = [];
  if (!candidate.title?.trim()) errors.push("missing_title");
  if (!candidate.assumptions?.length) errors.push("missing_assumptions");
  if (!candidate.limitations?.length) errors.push("missing_limitations");
  if (typeof candidate.confidence !== "number") errors.push("missing_confidence");
  if (!candidate.evidence?.length) errors.push("missing_evidence");
  if (candidate.executionInfluence !== "none") {
    errors.push("executionInfluence_must_be_none");
  }
  if (!candidate.whyResult?.trim()) errors.push("missing_whyResult");
  return { ok: errors.length === 0, errors };
}

export function filterValidScenarioCandidates<T extends ScenarioEngineCandidate>(
  candidates: T[]
): { valid: T[]; rejected: Array<{ candidate: T; errors: string[] }> } {
  const valid: T[] = [];
  const rejected: Array<{ candidate: T; errors: string[] }> = [];
  for (const c of candidates) {
    const result = validateScenarioCandidate(c);
    if (result.ok) valid.push(c);
    else rejected.push({ candidate: c, errors: result.errors });
  }
  return { valid, rejected };
}
