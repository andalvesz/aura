/**
 * Discovery explanation — always read-only, executionInfluence none.
 */

import { confidenceBand } from "@/lib/discovery/confidence";
import type {
  DiscoveryArtifact,
  DiscoveryExplanation,
} from "@/lib/discovery/types";

export function explainDiscovery(
  artifact: DiscoveryArtifact,
  history: DiscoveryExplanation["history"] = []
): DiscoveryExplanation {
  return {
    discoveryId: artifact.id,
    observed: artifact.description || artifact.summary,
    supportingData: artifact.evidence.map((e) => e.summary),
    limitations: artifact.limitations,
    alternativeInterpretations: artifact.alternativeInterpretations,
    confidence: artifact.confidence,
    confidenceBand: artifact.confidenceBand ?? confidenceBand(artifact.confidence),
    method: artifact.method,
    methodVersion: artifact.methodVersion,
    justificationSummary: artifact.explanation,
    executionInfluence: "none",
    history,
  };
}
