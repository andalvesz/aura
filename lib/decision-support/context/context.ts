/**
 * Build Decision Support context — READ-ONLY from upstream layers.
 * Never writes to Identity / Memory / World / Cognitive / Discovery / Knowledge / Projects.
 */

import type {
  DecisionContext,
  DecisionSourceSlice,
} from "@/lib/decision-support/types/types";

export function emptyDecisionSources(): DecisionSourceSlice {
  return {
    memories: [],
    worldEntities: [],
    cognitiveArtifacts: [],
    discoveries: [],
    knowledgeDocuments: [],
    projects: [],
    businesses: [],
    identityHints: [],
  };
}

export function buildDecisionContext(input: {
  sources?: Partial<DecisionSourceSlice>;
  maxItems?: number;
  correlationId?: string;
}): DecisionContext {
  const max = input.maxItems ?? 40;
  const raw = { ...emptyDecisionSources(), ...input.sources };
  const sources: DecisionSourceSlice = {
    memories: (raw.memories ?? []).slice(0, max),
    worldEntities: (raw.worldEntities ?? []).slice(0, max),
    cognitiveArtifacts: (raw.cognitiveArtifacts ?? []).slice(0, max),
    discoveries: (raw.discoveries ?? []).slice(0, max),
    knowledgeDocuments: (raw.knowledgeDocuments ?? []).slice(0, max),
    projects: (raw.projects ?? []).slice(0, max),
    businesses: (raw.businesses ?? []).slice(0, max),
    identityHints: (raw.identityHints ?? []).slice(0, max),
  };

  const gaps: string[] = [];
  if (!sources.memories.length) gaps.push("no_memories");
  if (!sources.worldEntities.length) gaps.push("no_world_entities");
  if (!sources.cognitiveArtifacts.length) gaps.push("no_cognitive_artifacts");
  if (!sources.discoveries.length) gaps.push("no_discoveries");
  if (!sources.knowledgeDocuments.length) gaps.push("no_knowledge");
  if (!sources.projects.length) gaps.push("no_projects");
  if (!sources.businesses.length) gaps.push("no_businesses");

  const sampleSize =
    sources.memories.length +
    sources.worldEntities.length +
    sources.cognitiveArtifacts.length +
    sources.discoveries.length +
    sources.knowledgeDocuments.length +
    sources.projects.length +
    sources.businesses.length;

  const score = Math.min(
    100,
    Math.round(
      (sources.memories.length ? 15 : 0) +
        (sources.worldEntities.length ? 10 : 0) +
        (sources.cognitiveArtifacts.length ? 15 : 0) +
        (sources.discoveries.length ? 20 : 0) +
        (sources.knowledgeDocuments.length ? 15 : 0) +
        (sources.projects.length ? 15 : 0) +
        (sources.businesses.length ? 10 : 0)
    )
  );

  return {
    sources,
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `dec_ctx_${Date.now()}`,
    readOnly: true,
    executionInfluence: "none",
  };
}
