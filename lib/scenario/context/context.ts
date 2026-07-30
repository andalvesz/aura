/**
 * Build Scenario context — READ-ONLY from upstream layers.
 */

import type {
  ScenarioContext,
  ScenarioSourceSlice,
} from "@/lib/scenario/types/types";

export function emptyScenarioSources(): ScenarioSourceSlice {
  return {
    memories: [],
    worldEntities: [],
    discoveries: [],
    knowledgeDocuments: [],
    projects: [],
    businesses: [],
    decisions: [],
  };
}

export function buildScenarioContext(input: {
  sources?: Partial<ScenarioSourceSlice>;
  maxItems?: number;
  correlationId?: string;
  whatIfPrompt?: string | null;
}): ScenarioContext {
  const max = input.maxItems ?? 40;
  const raw = { ...emptyScenarioSources(), ...input.sources };
  const sources: ScenarioSourceSlice = {
    memories: (raw.memories ?? []).slice(0, max),
    worldEntities: (raw.worldEntities ?? []).slice(0, max),
    discoveries: (raw.discoveries ?? []).slice(0, max),
    knowledgeDocuments: (raw.knowledgeDocuments ?? []).slice(0, max),
    projects: (raw.projects ?? []).slice(0, max),
    businesses: (raw.businesses ?? []).slice(0, max),
    decisions: (raw.decisions ?? []).slice(0, max),
  };

  const gaps: string[] = [];
  if (!sources.memories.length) gaps.push("no_memories");
  if (!sources.worldEntities.length) gaps.push("no_world_entities");
  if (!sources.discoveries.length) gaps.push("no_discoveries");
  if (!sources.knowledgeDocuments.length) gaps.push("no_knowledge");
  if (!sources.projects.length) gaps.push("no_projects");
  if (!sources.businesses.length) gaps.push("no_businesses");
  if (!sources.decisions.length) gaps.push("no_decisions");

  const sampleSize =
    sources.memories.length +
    sources.worldEntities.length +
    sources.discoveries.length +
    sources.knowledgeDocuments.length +
    sources.projects.length +
    sources.businesses.length +
    sources.decisions.length;

  const score = Math.min(
    100,
    Math.round(
      (sources.memories.length ? 12 : 0) +
        (sources.worldEntities.length ? 10 : 0) +
        (sources.discoveries.length ? 18 : 0) +
        (sources.knowledgeDocuments.length ? 15 : 0) +
        (sources.projects.length ? 18 : 0) +
        (sources.businesses.length ? 12 : 0) +
        (sources.decisions.length ? 15 : 0)
    )
  );

  return {
    sources,
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `scn_ctx_${Date.now()}`,
    readOnly: true,
    executionInfluence: "none",
    whatIfPrompt: input.whatIfPrompt ?? null,
  };
}
