/**
 * Entity resolution V1 — deterministic, prefer reviewable duplicates over bad merges.
 */

import type {
  SourceReference,
  WorldEntity,
  WorldSourceType,
} from "@/lib/world-model/types";

export function buildCanonicalKey(input: {
  sourceType: WorldSourceType;
  sourceReference?: SourceReference | null;
  entityType: string;
  contextualKey?: string;
  userId: string;
  workspaceId: string | null;
}): string {
  if (input.sourceReference?.entityType && input.sourceReference.entityId) {
    return [
      "src",
      input.sourceType,
      input.sourceReference.entityType,
      input.sourceReference.entityId,
    ].join(":");
  }
  const ctx = input.contextualKey?.trim().toLowerCase().replace(/\s+/g, "_") ?? "anon";
  return [
    "ctx",
    input.userId,
    input.workspaceId ?? "personal",
    input.entityType,
    ctx,
  ].join(":");
}

export type ResolveEntityInput = {
  userId: string;
  workspaceId?: string | null;
  entityType: string;
  sourceType: WorldSourceType;
  sourceReference?: SourceReference | null;
  externalReference?: string | null;
  canonicalKey?: string;
  displayName?: string;
};

/**
 * Priority:
 * 1. sourceType + sourceReference
 * 2. externalReference
 * 3. canonicalKey
 * Never merge by displayName alone.
 */
export function findEntityCandidates(
  entities: WorldEntity[],
  input: ResolveEntityInput
): WorldEntity[] {
  const scoped = entities.filter(
    (e) =>
      e.userId === input.userId &&
      e.status !== "DELETED" &&
      (input.workspaceId === undefined || e.workspaceId === (input.workspaceId ?? null))
  );

  if (input.sourceReference?.entityId) {
    const bySrc = scoped.filter(
      (e) =>
        e.sourceType === input.sourceType &&
        e.sourceReference?.entityType === input.sourceReference!.entityType &&
        e.sourceReference?.entityId === input.sourceReference!.entityId
    );
    if (bySrc.length) return bySrc;
  }

  if (input.externalReference) {
    const byExt = scoped.filter(
      (e) => e.externalReference === input.externalReference
    );
    if (byExt.length) return byExt;
  }

  const key =
    input.canonicalKey ??
    buildCanonicalKey({
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      entityType: input.entityType,
      contextualKey: input.displayName,
      userId: input.userId,
      workspaceId: input.workspaceId ?? null,
    });

  return scoped.filter((e) => e.canonicalKey === key && e.entityType === input.entityType);
}

export function resolveEntity(
  entities: WorldEntity[],
  input: ResolveEntityInput
): { entity: WorldEntity | null; candidates: WorldEntity[]; ambiguous: boolean } {
  const candidates = findEntityCandidates(entities, input);
  if (candidates.length === 0) {
    return { entity: null, candidates: [], ambiguous: false };
  }
  if (candidates.length === 1) {
    return { entity: candidates[0], candidates, ambiguous: false };
  }
  // Prefer CONFIRMED/ACTIVE; still ambiguous if multiple
  const preferred = candidates.filter(
    (c) => c.status === "CONFIRMED" || c.status === "ACTIVE"
  );
  if (preferred.length === 1) {
    return { entity: preferred[0], candidates, ambiguous: candidates.length > 1 };
  }
  return { entity: null, candidates, ambiguous: true };
}

/** Names alone never force a merge. */
export function sameDisplayNameIsNotSameEntity(
  a: WorldEntity,
  b: WorldEntity
): boolean {
  return (
    a.displayName.toLowerCase() === b.displayName.toLowerCase() &&
    a.canonicalKey !== b.canonicalKey
  );
}
