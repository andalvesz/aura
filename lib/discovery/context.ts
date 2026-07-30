/**
 * Build Discovery context from upstream kernel layers (read-only).
 */

import type {
  DiscoveryContext,
  DiscoveryContextInput,
  DiscoveryIdentityClaim,
} from "@/lib/discovery/types";

export type DiscoverySourcePayload = {
  identity?: DiscoveryIdentityClaim[];
  cognitiveArtifacts?: DiscoveryContext["cognitiveArtifacts"];
  memories?: DiscoveryContext["memories"];
  worldEntities?: DiscoveryContext["worldEntities"];
  /** Alias for worldEntities (legacy service/tests). */
  entities?: DiscoveryContext["worldEntities"];
  worldRelationships?: DiscoveryContext["worldRelationships"];
  /** Alias for worldRelationships (legacy service/tests). */
  relationships?: DiscoveryContext["worldRelationships"];
  missions?: DiscoveryContext["missions"];
};

export function buildDiscoveryContext(
  input: DiscoveryContextInput,
  sources: DiscoverySourcePayload = {}
): DiscoveryContext {
  const max = input.maxItems ?? 40;
  const identity = (sources.identity ?? []).slice(0, max);
  const cognitiveArtifacts = (sources.cognitiveArtifacts ?? []).slice(0, max);
  const memories = (sources.memories ?? []).slice(0, max);
  const worldEntities = (
    sources.worldEntities ??
    sources.entities ??
    []
  ).slice(0, max);
  const worldRelationships = (
    sources.worldRelationships ??
    sources.relationships ??
    []
  ).slice(0, max);
  const missions = (sources.missions ?? []).slice(0, max);

  const sampleSize =
    cognitiveArtifacts.length +
    memories.length +
    worldEntities.length +
    missions.length;

  const gaps: string[] = [];
  if (memories.length === 0) gaps.push("no_memories");
  if (worldEntities.length === 0) gaps.push("no_world_entities");
  if (cognitiveArtifacts.length === 0) gaps.push("no_cognitive_artifacts");
  if (missions.length === 0) gaps.push("no_missions");

  const score = Math.min(
    100,
    Math.round(
      (cognitiveArtifacts.length > 0 ? 30 : 0) +
        (memories.length > 0 ? 25 : 0) +
        (worldEntities.length > 0 ? 25 : 0) +
        (missions.length > 0 ? 20 : 0)
    )
  );

  return {
    identity,
    cognitiveArtifacts,
    memories,
    worldEntities,
    worldRelationships,
    missions,
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `disc_ctx_${Date.now()}`,
  };
}

export const buildDiscoveryContextPure = buildDiscoveryContext;
