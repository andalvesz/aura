/**
 * Read-only source providers for Recommendation Engine.
 * Never mutates upstream engines.
 */

import type { RecommendationSourceSlice } from "@/lib/recommendation/types/types";
import { emptyRecommendationSources } from "@/lib/recommendation/context/context";

export type RecommendationProviderBundle = Partial<RecommendationSourceSlice>;

export function collectRecommendationSources(
  bundle: RecommendationProviderBundle = {}
): RecommendationSourceSlice {
  const base = emptyRecommendationSources();
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
    priorities: bundle.priorities ?? base.priorities,
  };
}

export const RECOMMENDATION_PROVIDER_LAYERS = [
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
  "prioritization",
] as const;
