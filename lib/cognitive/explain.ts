/**
 * Explanation contracts — no private chain-of-thought.
 */

import type {
  CognitiveArtifact,
  CognitiveExplanation,
} from "@/lib/cognitive/types";

export function explainCognitiveArtifact(
  artifact: CognitiveArtifact
): CognitiveExplanation {
  return {
    artifactId: artifact.id,
    observed: artifact.summary,
    supportingData: artifact.evidence.map((e) => e.summary),
    period:
      artifact.timeRange.label ??
      `${artifact.timeRange.from ?? "?"} → ${artifact.timeRange.to ?? "?"}`,
    context: String(artifact.structuredContent.context ?? artifact.category),
    limitations: artifact.limitations,
    counterEvidence: artifact.counterEvidence.map((e) => e.summary),
    alternativeHypotheses: artifact.alternativeHypotheses.map((h) => h.statement),
    confidence: artifact.confidence,
    confidenceBand: artifact.confidenceBand,
    userConfirmed: artifact.status === "CONFIRMED",
    generatedAction: false,
    method: artifact.method,
    methodVersion: artifact.methodVersion,
    premises: artifact.assumptions.map((a) => a.statement),
    rulesApplied: [
      "correlation_not_causation",
      "evidence_required",
      "executionInfluence:none",
      "no_private_chain_of_thought",
    ],
    justificationSummary: `Método ${artifact.method} (${artifact.methodVersion}) com ${artifact.evidence.length} evidência(s) independente(s) referenciadas.`,
    executionInfluence: "none",
  };
}

export function explainPattern(artifact: CognitiveArtifact): CognitiveExplanation {
  return explainCognitiveArtifact(artifact);
}

export function explainInsight(artifact: CognitiveArtifact): CognitiveExplanation {
  return explainCognitiveArtifact(artifact);
}

export function explainRecommendation(
  artifact: CognitiveArtifact
): CognitiveExplanation {
  return explainCognitiveArtifact(artifact);
}
