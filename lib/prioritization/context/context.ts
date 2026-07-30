/**
 * Build Prioritization context — READ-ONLY from upstream layers.
 * Never writes to Identity / Memory / World / Cognitive / Discovery /
 * Knowledge / Projects / Business / Decision / Scenario.
 */

import type {
  PriorityContext,
  PrioritySourceSlice,
} from "@/lib/prioritization/types/types";

export function emptyPrioritySources(): PrioritySourceSlice {
  return {
    identityHints: [],
    memories: [],
    worldEntities: [],
    cognitiveArtifacts: [],
    discoveries: [],
    knowledgeDocuments: [],
    projects: [],
    businesses: [],
    decisions: [],
    scenarios: [],
  };
}

export function buildPriorityContext(input: {
  sources?: Partial<PrioritySourceSlice>;
  maxItems?: number;
  correlationId?: string;
}): PriorityContext {
  const max = input.maxItems ?? 40;
  const raw = { ...emptyPrioritySources(), ...input.sources };
  const sources: PrioritySourceSlice = {
    identityHints: (raw.identityHints ?? []).slice(0, max),
    memories: (raw.memories ?? []).slice(0, max),
    worldEntities: (raw.worldEntities ?? []).slice(0, max),
    cognitiveArtifacts: (raw.cognitiveArtifacts ?? []).slice(0, max),
    discoveries: (raw.discoveries ?? []).slice(0, max),
    knowledgeDocuments: (raw.knowledgeDocuments ?? []).slice(0, max),
    projects: (raw.projects ?? []).slice(0, max),
    businesses: (raw.businesses ?? []).slice(0, max),
    decisions: (raw.decisions ?? []).slice(0, max),
    scenarios: (raw.scenarios ?? []).slice(0, max),
  };

  const gaps: string[] = [];
  if (!sources.identityHints.length) gaps.push("no_identity");
  if (!sources.memories.length) gaps.push("no_memories");
  if (!sources.worldEntities.length) gaps.push("no_world_entities");
  if (!sources.cognitiveArtifacts.length) gaps.push("no_cognitive_artifacts");
  if (!sources.discoveries.length) gaps.push("no_discoveries");
  if (!sources.knowledgeDocuments.length) gaps.push("no_knowledge");
  if (!sources.projects.length) gaps.push("no_projects");
  if (!sources.businesses.length) gaps.push("no_businesses");
  if (!sources.decisions.length) gaps.push("no_decisions");
  if (!sources.scenarios.length) gaps.push("no_scenarios");

  const sampleSize =
    sources.identityHints.length +
    sources.memories.length +
    sources.worldEntities.length +
    sources.cognitiveArtifacts.length +
    sources.discoveries.length +
    sources.knowledgeDocuments.length +
    sources.projects.length +
    sources.businesses.length +
    sources.decisions.length +
    sources.scenarios.length;

  const score = Math.min(
    100,
    Math.round(
      (sources.identityHints.length ? 8 : 0) +
        (sources.memories.length ? 10 : 0) +
        (sources.worldEntities.length ? 8 : 0) +
        (sources.cognitiveArtifacts.length ? 10 : 0) +
        (sources.discoveries.length ? 14 : 0) +
        (sources.knowledgeDocuments.length ? 10 : 0) +
        (sources.projects.length ? 12 : 0) +
        (sources.businesses.length ? 8 : 0) +
        (sources.decisions.length ? 12 : 0) +
        (sources.scenarios.length ? 8 : 0)
    )
  );

  return {
    sources,
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `prio_ctx_${Date.now()}`,
    readOnly: true,
    executionInfluence: "none",
  };
}
