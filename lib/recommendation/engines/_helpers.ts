/**
 * Shared helpers for Recommendation engines.
 */

import { computeRecommendationScore } from "@/lib/recommendation/ranking";
import {
  confidenceBandOf,
  newRecommendationId,
  type EffortLevel,
  type ImpactLevel,
  type RecommendationEngineCandidate,
  type RecommendationEngineId,
  type RecommendationEvidence,
  type RecommendationReasoning,
  type RecommendationType,
  type ReversibilityLevel,
  type UrgencyLevel,
} from "@/lib/recommendation/types/types";

export function makeEvidence(input: {
  evidenceType: string;
  sourceLayer: RecommendationEvidence["sourceLayer"];
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence?: number;
}): RecommendationEvidence {
  return {
    id: newRecommendationId("rev"),
    evidenceType: input.evidenceType,
    sourceLayer: input.sourceLayer,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    summary: input.summary,
    confidence: input.confidence ?? 50,
    observedAt: new Date().toISOString(),
  };
}

export function fingerprintOf(engineId: string, parts: string[]): string {
  return `${engineId}::${parts.join("|")}`.toLowerCase().slice(0, 180);
}

export function parseLevel(
  value: string | undefined,
  fallback: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"
): "LOW" | "MEDIUM" | "HIGH" {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") return value;
  return fallback;
}

export function buildCandidate(input: {
  userId: string;
  workspaceId?: string | null;
  engineId: RecommendationEngineId;
  recommendationType: RecommendationType;
  title: string;
  summary: string;
  confidence: number;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  effort?: EffortLevel;
  reversibility?: ReversibilityLevel;
  evidence: RecommendationEvidence[];
  limitations: string[];
  alternatives: RecommendationEngineCandidate["alternatives"];
  reasoning: RecommendationReasoning;
  explanation: string;
  criteriaContributed: string[];
  missingData?: string[];
  fingerprint: string;
  relatedDecision?: string | null;
  relatedScenario?: string | null;
  relatedPriority?: string | null;
  relatedProject?: string | null;
  relatedDiscovery?: string | null;
  relatedBusinessIds?: string[];
  relatedDocumentIds?: string[];
  relatedMemoryIds?: string[];
  relatedEntityIds?: string[];
  signalObservedAt?: string | null;
  completenessScore?: number;
  pipelineSteps?: string[];
}): RecommendationEngineCandidate {
  const impact = input.impact ?? "MEDIUM";
  const urgency = input.urgency ?? "MEDIUM";
  const effort = input.effort ?? "MEDIUM";
  const reversibility = input.reversibility ?? "MEDIUM";
  const confidence = Math.max(0, Math.min(100, Math.round(input.confidence)));
  const breakdown = computeRecommendationScore({
    impact,
    urgency,
    confidence,
    effort,
    reversibility,
    signalObservedAt: input.signalObservedAt,
    completenessScore: input.completenessScore,
  });

  return {
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    engineId: input.engineId,
    recommendationType: input.recommendationType,
    title: input.title,
    summary: input.summary,
    priorityScore: breakdown.total,
    scoreBreakdown: breakdown,
    confidence,
    confidenceBand: confidenceBandOf(confidence),
    impact,
    urgency,
    effort,
    reversibility,
    evidence: input.evidence,
    limitations: input.limitations,
    alternatives: input.alternatives,
    reasoning: input.reasoning,
    relatedDecision: input.relatedDecision ?? null,
    relatedScenario: input.relatedScenario ?? null,
    relatedPriority: input.relatedPriority ?? null,
    relatedProject: input.relatedProject ?? null,
    relatedDiscovery: input.relatedDiscovery ?? null,
    relatedBusinessIds: input.relatedBusinessIds ?? [],
    relatedDocumentIds: input.relatedDocumentIds ?? [],
    relatedMemoryIds: input.relatedMemoryIds ?? [],
    relatedEntityIds: input.relatedEntityIds ?? [],
    executionInfluence: "none",
    explanation: input.explanation,
    criteriaContributed: input.criteriaContributed,
    missingData: input.missingData ?? [],
    fingerprint: input.fingerprint,
    signalObservedAt: input.signalObservedAt ?? null,
    pipelineSteps: input.pipelineSteps ?? [
      "sources_read",
      "engine_score",
      "validator",
      "registry_merge",
    ],
  };
}

export { LEVEL_SCORE, REVERSIBILITY_SCORE } from "@/lib/recommendation/ranking";
