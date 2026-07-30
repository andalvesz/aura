/**
 * Read-only source providers for Decision Support.
 * Never mutates upstream engines.
 */

import type { DecisionSourceSlice } from "@/lib/decision-support/types/types";
import { emptyDecisionSources } from "@/lib/decision-support/context/context";

export type DecisionProviderBundle = Partial<DecisionSourceSlice>;

/**
 * Normalize heterogeneous upstream payloads into DecisionSourceSlice.
 * Safe for missing/partial inputs.
 */
export function collectDecisionSources(
  bundle: DecisionProviderBundle = {}
): DecisionSourceSlice {
  const base = emptyDecisionSources();
  return {
    memories: bundle.memories ?? base.memories,
    worldEntities: bundle.worldEntities ?? base.worldEntities,
    cognitiveArtifacts: bundle.cognitiveArtifacts ?? base.cognitiveArtifacts,
    discoveries: bundle.discoveries ?? base.discoveries,
    knowledgeDocuments: bundle.knowledgeDocuments ?? base.knowledgeDocuments,
    projects: bundle.projects ?? base.projects,
    businesses: bundle.businesses ?? base.businesses,
    identityHints: bundle.identityHints ?? base.identityHints,
  };
}

export const DECISION_PROVIDER_LAYERS = [
  "identity",
  "memory",
  "world",
  "cognitive",
  "discovery",
  "knowledge",
  "projects",
  "business",
] as const;
