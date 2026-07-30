/**
 * Read-only source providers for Scenario Engine.
 */

import { emptyScenarioSources } from "@/lib/scenario/context/context";
import type { ScenarioSourceSlice } from "@/lib/scenario/types/types";

export type ScenarioProviderBundle = Partial<ScenarioSourceSlice>;

export function collectScenarioSources(
  bundle: ScenarioProviderBundle = {}
): ScenarioSourceSlice {
  const base = emptyScenarioSources();
  return {
    memories: bundle.memories ?? base.memories,
    worldEntities: bundle.worldEntities ?? base.worldEntities,
    discoveries: bundle.discoveries ?? base.discoveries,
    knowledgeDocuments: bundle.knowledgeDocuments ?? base.knowledgeDocuments,
    projects: bundle.projects ?? base.projects,
    businesses: bundle.businesses ?? base.businesses,
    decisions: bundle.decisions ?? base.decisions,
  };
}

export const SCENARIO_PROVIDER_LAYERS = [
  "projects",
  "business",
  "discovery",
  "knowledge",
  "memory",
  "world",
  "decision",
] as const;
