/**
 * World Model service — app facade (Sprint 6.4).
 */

import { applyBootstrapToWorldState } from "@/lib/world-model/bootstrap";
import {
  archiveEntityPure,
  archiveRelationshipPure,
  confirmRelationshipPure,
  correctEntityProjectionPure,
  correctRelationshipPure,
  createWorldEntityPure,
  createWorldRelationshipPure,
  explainEntityPure,
  explainRelationshipPure,
  findPathPure,
  getEntityNeighborsPure,
  getEntityRelationshipsPure,
  getRelationshipPure,
  getRelationshipTimelinePure,
  getWorldContextForBrainPure,
  getWorldEntityPure,
  listWorldEntitiesPure,
  mergeEntitiesPure,
  reconcileEntityFromSourcePure,
  rejectRelationshipPure,
  searchWorldEntitiesPure,
  type WorldModelState,
} from "@/lib/world-model/engine";
import { projectIdentityToWorldModelPure } from "@/lib/world-model/projectors/identity.projector";
import { projectMemoryToWorldModelPure } from "@/lib/world-model/projectors/memory.projector";
import { projectMissionToWorldModelPure } from "@/lib/world-model/projectors/mission.projector";
import { projectBusinessToWorldModelPure } from "@/lib/world-model/projectors/business.projector";
import { projectDocumentToWorldModelPure } from "@/lib/world-model/projectors/document.projector";
import {
  getCachedWorldRead,
  getWorldState,
  invalidateWorldCache,
  listWorldAudits,
  setCachedWorldRead,
  setWorldState,
  worldCacheKey,
} from "@/lib/world-model/store";
import { confidenceBand } from "@/lib/world-model/confidence";
import type {
  CreateWorldEntityInput,
  CreateWorldRelationshipInput,
  ProjectionReport,
  WorldAuditEvent,
  WorldBrainContext,
  WorldEntity,
  WorldEntityFilters,
  WorldNeighborFilters,
  WorldPath,
  WorldRelationship,
} from "@/lib/world-model/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { getIdentityClaims } from "@/lib/supabase/services/identity-engine.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import { listStoredMissions } from "@/lib/missions/mission-store";

type LooseClient = {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (
        col: string,
        val: string
      ) => {
        order: (
          col: string,
          opts?: { ascending?: boolean }
        ) => Promise<{
          data: Record<string, unknown>[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      row: Record<string, unknown> | Record<string, unknown>[],
      opts?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
    insert: (
      row: Record<string, unknown> | Record<string, unknown>[]
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function loose(supabase: unknown): LooseClient {
  return supabase as LooseClient;
}

function entityToRow(e: WorldEntity): Record<string, unknown> {
  return {
    id: e.id,
    user_id: e.userId,
    workspace_id: e.workspaceId,
    entity_type: e.entityType,
    canonical_key: e.canonicalKey,
    display_name: e.displayName,
    description: e.description,
    status: e.status,
    confidence: e.confidence,
    importance: e.importance,
    sensitivity: e.sensitivity,
    context: e.context,
    attributes: e.attributes,
    source_type: e.sourceType,
    source_reference: e.sourceReference,
    external_reference: e.externalReference,
    aliases: e.aliases,
    valid_from: e.validFrom,
    valid_until: e.validUntil,
    first_observed_at: e.firstObservedAt,
    last_observed_at: e.lastObservedAt,
    merged_into_id: e.mergedIntoId,
    score_history: e.scoreHistory,
    payload: e,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    archived_at: e.archivedAt,
    deleted_at: e.deletedAt,
  };
}

function rowToEntity(row: Record<string, unknown>): WorldEntity | null {
  const payload = row.payload as WorldEntity | undefined;
  if (payload?.id && payload.canonicalKey) {
    return {
      ...payload,
      confidenceBand:
        payload.confidenceBand ?? confidenceBand(payload.confidence),
    };
  }
  return null;
}

async function loadFromDb(
  supabase: unknown,
  userId: string
): Promise<WorldEntity[]> {
  try {
    const { data, error } = await loose(supabase)
      .from("aura_world_entities")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((r) => rowToEntity(r))
      .filter((e): e is WorldEntity => Boolean(e));
  } catch {
    return [];
  }
}

async function persistEntity(supabase: unknown, e: WorldEntity): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_world_entities")
      .upsert(entityToRow(e), { onConflict: "id" });
  } catch {
    // best-effort
  }
}

async function persistAudit(
  supabase: unknown,
  event: WorldAuditEvent
): Promise<void> {
  try {
    await loose(supabase).from("aura_world_audit").insert({
      id: event.id,
      user_id: event.userId,
      workspace_id: event.workspaceId,
      entity_id: event.entityId,
      relationship_id: event.relationshipId,
      action: event.action,
      previous_state: event.previousState,
      next_state: event.nextState,
      source_type: event.sourceType,
      reason: event.reason,
      correlation_id: event.correlationId,
      created_at: event.createdAt,
    });
  } catch {
    // best-effort
  }
}

async function hydrate(
  userId: string,
  supabase: unknown
): Promise<WorldModelState> {
  let state = getWorldState(userId);
  if (state.entities.length === 0) {
    const fromDb = await loadFromDb(supabase, userId);
    if (fromDb.length > 0) {
      state = { ...state, entities: fromDb };
      setWorldState(userId, state);
    }
  }
  return state;
}

async function commit(
  userId: string,
  state: WorldModelState,
  supabase: unknown,
  changedEntityIds: string[] = []
): Promise<void> {
  setWorldState(userId, state);
  invalidateWorldCache(userId);
  for (const id of changedEntityIds) {
    const e = state.entities.find((x) => x.id === id);
    if (e) await persistEntity(supabase, e);
  }
  for (const a of state.audits.slice(0, 8)) {
    await persistAudit(supabase, a);
  }
}

function ws(
  ctx: Awaited<ReturnType<typeof getDataContext>>,
  explicit?: string | null
): string | null {
  if (explicit !== undefined) return explicit;
  return ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null;
}

export async function getWorldEntity(
  id: string
): Promise<WorldEntity | null> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getWorldEntityPure(state, ctx.userId, id);
}

export async function listWorldEntities(
  filters?: WorldEntityFilters
): Promise<WorldEntity[]> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return listWorldEntitiesPure(state, ctx.userId, {
    ...filters,
    workspaceId: ws(ctx, filters?.workspaceId),
  });
}

/** Public relationship list — UI must not read world store directly (RC1). */
export async function listWorldRelationships(options?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<WorldRelationship[]> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  let rels = state.relationships.filter(
    (r) =>
      r.userId === ctx.userId &&
      r.deletedAt == null &&
      r.status !== "DELETED"
  );
  if (!options?.includeArchived) {
    rels = rels.filter(
      (r) => r.status !== "ARCHIVED" && r.archivedAt == null
    );
  }
  return rels.slice(0, options?.limit ?? 100);
}

export async function searchWorldEntities(
  filters?: WorldEntityFilters
): Promise<{ items: WorldEntity[]; nextCursor: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return searchWorldEntitiesPure(state, ctx.userId, {
    ...filters,
    workspaceId: ws(ctx, filters?.workspaceId),
  });
}

export async function createWorldEntity(
  input: CreateWorldEntityInput
): Promise<{ entity: WorldEntity | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = createWorldEntityPure(state, ctx.userId, {
    ...input,
    workspaceId: ws(ctx, input.workspaceId),
  });
  if (!res.ok || !res.data) return { entity: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { entity: res.data, error: null };
}

export async function createWorldRelationship(
  input: CreateWorldRelationshipInput
): Promise<{ relationship: WorldRelationship | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = createWorldRelationshipPure(state, ctx.userId, {
    ...input,
    workspaceId: ws(ctx, input.workspaceId),
  });
  if (!res.ok || !res.data) return { relationship: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase, [
    res.data.sourceEntityId,
    res.data.targetEntityId,
  ]);
  return { relationship: res.data, error: null };
}

export async function getEntityNeighbors(
  entityId: string,
  filters?: WorldNeighborFilters
) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getEntityNeighborsPure(state, ctx.userId, entityId, filters);
}

export async function getEntityRelationships(entityId: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getEntityRelationshipsPure(state, ctx.userId, entityId);
}

export async function getRelationship(id: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getRelationshipPure(state, ctx.userId, id);
}

export async function findPath(
  fromEntityId: string,
  toEntityId: string,
  options?: { maxDepth?: number; limit?: number }
): Promise<WorldPath[]> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return findPathPure(state, ctx.userId, fromEntityId, toEntityId, options);
}

export async function explainEntity(entityId: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return explainEntityPure(state, ctx.userId, entityId);
}

export async function explainRelationship(relationshipId: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return explainRelationshipPure(state, ctx.userId, relationshipId);
}

export async function getRelationshipTimeline(entityId?: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getRelationshipTimelinePure(state, ctx.userId, entityId);
}

export async function confirmRelationship(id: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = confirmRelationshipPure(state, ctx.userId, id);
  if (!res.ok || !res.data) return { relationship: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase);
  return { relationship: res.data, error: null };
}

export async function rejectRelationship(id: string, reason: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = rejectRelationshipPure(state, ctx.userId, id, reason);
  if (!res.ok || !res.data) return { relationship: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase);
  return { relationship: res.data, error: null };
}

export async function correctRelationship(input: {
  relationshipId: string;
  relationshipType?: string;
  reason: string;
}) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = correctRelationshipPure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { relationship: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase);
  return { relationship: res.data, error: null };
}

export async function archiveEntity(id: string, reason?: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = archiveEntityPure(state, ctx.userId, id, reason);
  if (!res.ok || !res.data) return { entity: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase, [id]);
  return { entity: res.data, error: null };
}

export async function archiveRelationship(id: string, reason?: string) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = archiveRelationshipPure(state, ctx.userId, id, reason);
  if (!res.ok || !res.data) return { relationship: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase);
  return { relationship: res.data, error: null };
}

export async function mergeEntities(
  sourceId: string,
  targetId: string,
  reason: string
) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = mergeEntitiesPure(state, ctx.userId, sourceId, targetId, reason);
  if (!res.ok || !res.data) return { entity: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase, [sourceId, targetId]);
  return { entity: res.data, error: null };
}

export async function correctEntityProjection(input: {
  entityId: string;
  displayName?: string;
  description?: string;
  reason: string;
}) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = correctEntityProjectionPure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { entity: null, error: res.error };
  await commit(ctx.userId, res.state, ctx.supabase, [input.entityId]);
  return { entity: res.data, error: null };
}

export async function projectMemoryToWorldModel(
  memoryId: string
): Promise<{ report: ProjectionReport | null; error: string | null }> {
  const ctx = await getDataContext();
  const memories = await listMemories({ includeArchived: false, limit: 200 });
  const memory = memories.find((m) => m.id === memoryId);
  if (!memory) return { report: null, error: "Memória não encontrada" };
  const state = await hydrate(ctx.userId, ctx.supabase);
  const person = state.entities.find(
    (e) => e.entityType === "person" && e.sourceReference?.entityId === ctx.userId
  );
  const { state: next, report } = projectMemoryToWorldModelPure(
    state,
    ctx.userId,
    memory,
    { personEntityId: person?.id }
  );
  await commit(
    ctx.userId,
    next,
    ctx.supabase,
    next.entities.map((e) => e.id)
  );
  return { report, error: null };
}

export async function projectIdentityToWorldModel(
  claimId: string
): Promise<{ report: ProjectionReport | null; error: string | null }> {
  const ctx = await getDataContext();
  const claims = await getIdentityClaims({ includeRejected: true });
  const claim = claims.find((c) => c.id === claimId);
  if (!claim) return { report: null, error: "Claim não encontrada" };
  const state = await hydrate(ctx.userId, ctx.supabase);
  const person = state.entities.find(
    (e) => e.entityType === "person" && e.sourceReference?.entityId === ctx.userId
  );
  const { state: next, report } = projectIdentityToWorldModelPure(
    state,
    ctx.userId,
    claim,
    { personEntityId: person?.id }
  );
  await commit(
    ctx.userId,
    next,
    ctx.supabase,
    next.entities.map((e) => e.id)
  );
  return { report, error: null };
}

export async function projectMissionToWorldModel(
  missionId: string
): Promise<{ report: ProjectionReport | null; error: string | null }> {
  const ctx = await getDataContext();
  const mission = listStoredMissions(ctx.userId).find((m) => m.id === missionId);
  if (!mission) return { report: null, error: "Missão não encontrada" };
  const state = await hydrate(ctx.userId, ctx.supabase);
  const person = state.entities.find(
    (e) => e.entityType === "person" && e.sourceReference?.entityId === ctx.userId
  );
  const { state: next, report } = projectMissionToWorldModelPure(
    state,
    ctx.userId,
    mission,
    { personEntityId: person?.id }
  );
  await commit(
    ctx.userId,
    next,
    ctx.supabase,
    next.entities.map((e) => e.id)
  );
  return { report, error: null };
}

export async function bootstrapWorldModel(options?: {
  dryRun?: boolean;
  maxItems?: number;
}) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  let claims: Awaited<ReturnType<typeof getIdentityClaims>> = [];
  try {
    claims = (await getIdentityClaims()).filter(
      (c) => c.status === "CONFIRMED" || c.status === "LEARNED"
    );
  } catch {
    claims = [];
  }

  let memories: Awaited<ReturnType<typeof listMemories>> = [];
  try {
    memories = (await listMemories({ limit: 40 })).filter(
      (m) =>
        m.status === "CONFIRMED" ||
        m.promotionStatus === "PROPOSED_IDENTITY" ||
        m.promotionStatus === "FUTURE_GRAPH_CANDIDATE"
    );
  } catch {
    memories = [];
  }

  const missions = listStoredMissions(ctx.userId);

  const { state: next, report } = applyBootstrapToWorldState(state, {
    userId: ctx.userId,
    displayName: profile?.full_name,
    claims,
    memories,
    missions,
    dryRun: options?.dryRun,
    maxItems: options?.maxItems ?? 50,
  });

  if (!options?.dryRun && report.created > 0) {
    await commit(
      ctx.userId,
      next,
      ctx.supabase,
      next.entities.map((e) => e.id)
    );
  }

  return { report, error: null };
}

export async function getWorldContextForBrain(input?: {
  workspaceId?: string | null;
  limit?: number;
  context?: string;
}): Promise<WorldBrainContext> {
  const ctx = await getDataContext();
  const ck = worldCacheKey(
    ctx.userId,
    ws(ctx, input?.workspaceId),
    `brain:${input?.context ?? "all"}`
  );
  const cached = getCachedWorldRead<WorldBrainContext>(ck);
  if (cached) return cached;

  const state = await hydrate(ctx.userId, ctx.supabase);
  const brain = getWorldContextForBrainPure(state, ctx.userId, {
    ...input,
    workspaceId: ws(ctx, input?.workspaceId),
  });
  setCachedWorldRead(ck, brain);
  return brain;
}

export async function getWorldAuditLog(limit = 40) {
  const ctx = await getDataContext();
  await hydrate(ctx.userId, ctx.supabase);
  return listWorldAudits(ctx.userId, limit);
}

export async function reconcileWorldEntity(input: {
  sourceType: CreateWorldEntityInput["sourceType"];
  sourceReference: { entityType: string; entityId: string };
  patch: Partial<CreateWorldEntityInput>;
  sourceDeleted?: boolean;
}) {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const res = reconcileEntityFromSourcePure(state, ctx.userId, input);
  if (!res.ok) return { error: res.error, data: null };
  await commit(
    ctx.userId,
    res.state,
    ctx.supabase,
    res.data?.entity ? [res.data.entity.id] : []
  );
  return { error: null, data: res.data };
}

// re-export projectors for typed usage
export {
  projectBusinessToWorldModelPure,
  projectDocumentToWorldModelPure,
};
