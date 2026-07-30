/**
 * Cognitive Context Builder — read-only assembly from source layers.
 * Does not promote, mutate sources, or create claims.
 */

import { buildEvidenceIndex } from "@/lib/cognitive/evidence";
import type {
  CognitiveContext,
  CognitiveContextInput,
  CognitiveSensitivity,
} from "@/lib/cognitive/types";

const DEFAULT_MAX = 40;

export type ContextSourcePayload = {
  identityClaims?: CognitiveContext["identityContext"]["claims"];
  memories?: CognitiveContext["memoryContext"]["memories"];
  worldEntities?: CognitiveContext["worldContext"]["entities"];
  worldRelationships?: CognitiveContext["worldContext"]["relationships"];
  missions?: CognitiveContext["missionContext"]["missions"];
};

function filterSensitive<T extends { sensitivity?: CognitiveSensitivity }>(
  items: T[],
  scope?: CognitiveSensitivity[]
): T[] {
  if (!scope || scope.length === 0) {
    return items.filter((i) => i.sensitivity !== "RESTRICTED");
  }
  return items.filter(
    (i) => !i.sensitivity || scope.includes(i.sensitivity)
  );
}

export function buildCognitiveContext(
  input: CognitiveContextInput,
  sources: ContextSourcePayload
): CognitiveContext {
  const max = input.maxItems ?? DEFAULT_MAX;
  const exclusions: string[] = [];
  const constraints: string[] = [
    "read_only_sources",
    "executionInfluence:none",
    "no_silent_mutation",
  ];

  let claims = (sources.identityClaims ?? []).filter(
    (c) => !["REJECTED", "DELETED", "ARCHIVED"].includes(c.status)
  );
  let memories = (sources.memories ?? []).filter(
    (m) => !["REJECTED", "DELETED", "ARCHIVED", "DISPUTED"].includes(m.status)
  );
  let entities = (sources.worldEntities ?? []).filter(
    (e) => !["REJECTED", "DELETED", "ARCHIVED"].includes(e.status)
  );
  let relationships = (sources.worldRelationships ?? []).filter(
    (r) => !["REJECTED", "DELETED", "ARCHIVED"].includes(r.status)
  );
  let missions = sources.missions ?? [];

  if (input.memoryIds?.length) {
    const set = new Set(input.memoryIds);
    memories = memories.filter((m) => set.has(m.id));
  }
  if (input.entityIds?.length) {
    const set = new Set(input.entityIds);
    entities = entities.filter((e) => set.has(e.id));
  }
  if (input.missionIds?.length) {
    const set = new Set(input.missionIds);
    missions = missions.filter((m) => set.has(m.id));
  }
  if (input.subjectIds?.length) {
    const set = new Set(input.subjectIds);
    claims = claims.filter(
      (c) => set.has(c.id) || set.has(c.key) || set.has(c.category)
    );
  }

  const before = claims.length + memories.length + entities.length;
  claims = claims.slice(0, max);
  memories = memories.slice(0, max);
  entities = entities.slice(0, max);
  relationships = relationships.slice(0, max);
  missions = missions.slice(0, Math.min(20, max));

  if (before > max * 3) {
    exclusions.push("volume_capped");
  }

  const gaps: string[] = [];
  if (claims.length === 0) gaps.push("no_identity_claims");
  if (memories.length === 0) gaps.push("no_memories");
  if (entities.length === 0) gaps.push("no_world_entities");
  if (missions.length === 0) gaps.push("no_missions");

  const sampleSize =
    claims.length + memories.length + entities.length + missions.length;
  const completeness = Math.min(
    100,
    (sampleSize / Math.max(8, Math.min(max, 20))) * 100
  );

  const temporal = input.timeRange ?? { from: null, to: null, label: "all_available" };

  const ctx: CognitiveContext = {
    identityContext: { claims },
    memoryContext: { memories },
    worldContext: { entities, relationships },
    missionContext: { missions },
    temporalContext: temporal,
    evidenceIndex: [],
    constraints,
    exclusions,
    dataCompleteness: {
      score: Math.round(completeness),
      gaps,
      sampleSize,
    },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `ctx_${Date.now()}`,
  };

  ctx.evidenceIndex = buildEvidenceIndex(ctx);
  return ctx;
}

/** Alias used by public contracts */
export const buildCognitiveContextPure = buildCognitiveContext;
