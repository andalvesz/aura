/**
 * Shared helpers for Decision Support engines.
 */

import {
  confidenceBandOf,
  newDecisionId,
  type DecisionEngineCandidate,
  type DecisionEngineId,
  type DecisionEvidence,
  type DecisionKind,
  type EffortLevel,
  type ImpactLevel,
  type ReversibilityLevel,
  type UrgencyLevel,
} from "@/lib/decision-support/types/types";

export function makeEvidence(input: {
  evidenceType: string;
  sourceLayer: DecisionEvidence["sourceLayer"];
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence?: number;
}): DecisionEvidence {
  return {
    id: newDecisionId("dev"),
    evidenceType: input.evidenceType,
    sourceLayer: input.sourceLayer,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    summary: input.summary,
    confidence: input.confidence ?? 50,
    observedAt: new Date().toISOString(),
  };
}

export function fingerprintOf(
  engineId: string,
  parts: string[]
): string {
  return `${engineId}::${parts.join("|")}`.toLowerCase().slice(0, 180);
}

export function buildCandidate(input: {
  userId: string;
  workspaceId?: string | null;
  engineId: DecisionEngineId;
  kind: DecisionKind;
  title: string;
  summary: string;
  context: string;
  confidence: number;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  effort?: EffortLevel;
  reversibility?: ReversibilityLevel;
  evidence: DecisionEvidence[];
  limitations: string[];
  alternativeOptions: DecisionEngineCandidate["alternativeOptions"];
  whyAppeared: string;
  explanation: string;
  fingerprint: string;
  relatedProjectIds?: string[];
  relatedBusinessIds?: string[];
  relatedDocumentIds?: string[];
  relatedDiscoveryIds?: string[];
  relatedMemoryIds?: string[];
  relatedEntityIds?: string[];
  tradeoff?: DecisionEngineCandidate["tradeoff"];
}): DecisionEngineCandidate {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    engineId: input.engineId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    context: input.context,
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
    confidenceBand: confidenceBandOf(input.confidence),
    impact: input.impact ?? "MEDIUM",
    urgency: input.urgency ?? "MEDIUM",
    effort: input.effort ?? "MEDIUM",
    reversibility: input.reversibility ?? "MEDIUM",
    evidence: input.evidence,
    limitations: input.limitations,
    alternativeOptions: input.alternativeOptions,
    executionInfluence: "none",
    explanation: input.explanation,
    whyAppeared: input.whyAppeared,
    relatedProjectIds: input.relatedProjectIds ?? [],
    relatedBusinessIds: input.relatedBusinessIds ?? [],
    relatedDocumentIds: input.relatedDocumentIds ?? [],
    relatedDiscoveryIds: input.relatedDiscoveryIds ?? [],
    relatedMemoryIds: input.relatedMemoryIds ?? [],
    relatedEntityIds: input.relatedEntityIds ?? [],
    fingerprint: input.fingerprint,
    tradeoff: input.tradeoff,
  };
}

export const LEVEL_SCORE: Record<"LOW" | "MEDIUM" | "HIGH", number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/** Reversibility HIGH = easier to undo = lower risk weight */
export const REVERSIBILITY_SCORE: Record<ReversibilityLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};
