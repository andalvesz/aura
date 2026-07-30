/**
 * Read-only source providers for Prioritization Engine.
 * Never mutates upstream engines.
 */

import type { PrioritySourceSlice } from "@/lib/prioritization/types/types";
import { emptyPrioritySources } from "@/lib/prioritization/context/context";

export type PriorityProviderBundle = Partial<PrioritySourceSlice>;

export function collectPrioritySources(
  bundle: PriorityProviderBundle = {}
): PrioritySourceSlice {
  const base = emptyPrioritySources();
  return {
    identityHints: bundle.identityHints ?? base.identityHints,
    memories: bundle.memories ?? base.memories,
    worldEntities: bundle.worldEntities ?? base.worldEntities,
    cognitiveArtifacts: bundle.cognitiveArtifacts ?? base.cognitiveArtifacts,
    discoveries: bundle.discoveries ?? base.discoveries,
    knowledgeDocuments: bundle.knowledgeDocuments ?? base.knowledgeDocuments,
    projects: bundle.projects ?? base.projects,
    businesses: bundle.businesses ?? base.businesses,
    decisions: bundle.decisions ?? base.decisions,
    scenarios: bundle.scenarios ?? base.scenarios,
  };
}

export const PRIORITY_PROVIDER_LAYERS = [
  "identity",
  "memory",
  "world",
  "cognitive",
  "discovery",
  "knowledge",
  "projects",
  "business",
  "decision",
  "scenario",
] as const;
