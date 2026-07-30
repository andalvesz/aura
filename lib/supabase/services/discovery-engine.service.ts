/**
 * Discovery Engine service — app facade (RC2.1 collaborative go-live).
 * ADR-006 · read-only for Brain · executionInfluence: none
 */

import {
  archiveDiscoveryPure,
  bootstrapDiscoveryEnginePure,
  generateDiscoveriesPure,
  getDiscoveryContextForBrainPure,
  getDiscoveryPure,
  listDiscoveriesPure,
  searchDiscoveriesPure,
  submitDiscoveryFeedbackPure,
  explainDiscoveryPure,
  type DiscoveryEngineState,
} from "@/lib/discovery/engine";
import { buildDiscoveryContextPure } from "@/lib/discovery/context";
import {
  discoveryCacheKey,
  getCachedDiscoveryRead,
  getDiscoveryState,
  invalidateDiscoveryCache,
  listDiscoveryAudits,
  setCachedDiscoveryRead,
  setDiscoveryState,
} from "@/lib/discovery/store";
import { mergeTimelineSources } from "@/lib/discovery/timeline";
import { confidenceBand } from "@/lib/discovery/confidence";
import { resolveVisibilityScope } from "@/lib/aura-brain/visibility";
import type {
  DiscoveryArtifact,
  DiscoveryAuditEvent,
  DiscoveryBootstrapReport,
  DiscoveryBrainContext,
  DiscoveryContext,
  DiscoveryExplanation,
  DiscoveryFeedbackKind,
  DiscoveryFilters,
  DiscoveryRun,
  TimelineEvent,
} from "@/lib/discovery/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { listCognitiveArtifacts } from "@/lib/supabase/services/cognitive-engine.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import {
  listWorldEntities,
  listWorldRelationships,
} from "@/lib/supabase/services/world-model.service";
import { listStoredMissions } from "@/lib/missions/mission-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AuraDiscoveryArtifactRow } from "@/types/aura-brain-database";

type BrainClient = SupabaseClient<Database>;

const SAFE_BOOTSTRAP_MAX = 24;

function stateKey(userId: string, workspaceId?: string | null): string {
  return workspaceId ? `${userId}::ws:${workspaceId}` : userId;
}

function artifactToRow(
  a: DiscoveryArtifact
): Database["public"]["Tables"]["aura_discovery_artifacts"]["Insert"] {
  return {
    id: a.id,
    user_id: a.userId,
    workspace_id: a.workspaceId,
    discovery_type: a.type,
    status: a.status,
    title: a.title,
    summary: a.summary,
    confidence: a.confidence,
    impact: a.impact,
    urgency: a.urgency,
    reversibility: a.reversibility,
    detector_id: a.detectorId,
    method: a.method,
    method_version: a.methodVersion,
    fingerprint: a.fingerprint,
    evidence_set_hash: a.evidenceSetHash,
    suppression_key: a.suppressionKey,
    origin: a.origin,
    execution_influence: "none",
    sensitivity: a.sensitivity,
    visibility_scope: resolveVisibilityScope(a.visibilityScope),
    row_version: a.rowVersion ?? 1,
    first_generated_at: a.firstGeneratedAt,
    last_validated_at: a.lastValidatedAt,
    payload: a as unknown as Database["public"]["Tables"]["aura_discovery_artifacts"]["Row"]["payload"],
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    archived_at: a.archivedAt,
    deleted_at: a.deletedAt,
  };
}

function rowToArtifact(row: AuraDiscoveryArtifactRow | Record<string, unknown>): DiscoveryArtifact | null {
  const payload = row.payload as DiscoveryArtifact | undefined;
  if (payload?.id && payload.fingerprint) {
    return {
      ...payload,
      visibilityScope: resolveVisibilityScope(
        payload.visibilityScope ??
          (row as AuraDiscoveryArtifactRow).visibility_scope
      ),
      rowVersion:
        payload.rowVersion ??
        (row as AuraDiscoveryArtifactRow).row_version ??
        1,
      confidenceBand:
        payload.confidenceBand ?? confidenceBand(payload.confidence),
      executionInfluence: "none",
    };
  }
  return null;
}

function isMigrationPendingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("relation") ||
    m.includes("schema cache") ||
    m.includes("could not find the table")
  );
}

async function loadFromDb(
  supabase: BrainClient,
  userId: string,
  workspaceId: string | null
): Promise<{ artifacts: DiscoveryArtifact[]; migrationPending: boolean }> {
  try {
    let query = supabase
      .from("aura_discovery_artifacts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(120);

    if (workspaceId) {
      query = query.or(
        `user_id.eq.${userId},and(workspace_id.eq.${workspaceId},visibility_scope.eq.WORKSPACE)`
      );
    } else {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      return {
        artifacts: [],
        migrationPending: isMigrationPendingError(error.message),
      };
    }
    const artifacts = (data ?? [])
      .map((r) => rowToArtifact(r as AuraDiscoveryArtifactRow))
      .filter((a): a is DiscoveryArtifact => Boolean(a));
    return { artifacts, migrationPending: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { artifacts: [], migrationPending: isMigrationPendingError(msg) };
  }
}

async function hydrate(
  userId: string,
  supabase: BrainClient,
  workspaceId: string | null
): Promise<{ state: DiscoveryEngineState; migrationPending: boolean }> {
  const key = stateKey(userId, workspaceId);
  let state = getDiscoveryState(key);
  let migrationPending = false;
  if (state.artifacts.length === 0) {
    const loaded = await loadFromDb(supabase, userId, workspaceId);
    migrationPending = loaded.migrationPending;
    if (loaded.artifacts.length) {
      state = { ...state, artifacts: loaded.artifacts };
      setDiscoveryState(key, state);
    }
  }
  return { state, migrationPending };
}

async function persistRun(
  supabase: BrainClient,
  run: DiscoveryRun
): Promise<void> {
  await supabase.from("aura_discovery_runs").upsert(
    {
      id: run.id,
      user_id: run.userId,
      workspace_id: run.workspaceId,
      correlation_id: run.correlationId,
      status: run.status,
      artifacts_generated: run.artifactsGenerated,
      suppressed_count: run.suppressedCount,
      reused_count: run.reusedCount,
      duration_ms: run.durationMs,
      dry_run: run.dryRun,
      report: {
        ...run.report,
        metrics: run.metrics,
        // Never log memory content / prompts / secrets
      },
      created_at: run.createdAt,
      completed_at: run.completedAt,
    },
    { onConflict: "id" }
  );
}

async function commit(
  userId: string,
  state: DiscoveryEngineState,
  supabase: BrainClient,
  workspaceId: string | null,
  changed?: DiscoveryArtifact[],
  run?: DiscoveryRun | null
): Promise<{ error: string | null; migrationPending: boolean }> {
  const key = stateKey(userId, workspaceId);
  setDiscoveryState(key, state);
  invalidateDiscoveryCache(userId);
  if (workspaceId) {
    invalidateDiscoveryCache(`${userId}::ws:${workspaceId}`);
  }

  try {
    const rows = (changed ?? state.artifacts.slice(0, 40)).map(artifactToRow);
    if (rows.length) {
      const { error } = await supabase
        .from("aura_discovery_artifacts")
        .upsert(rows, { onConflict: "id" });
      if (error) {
        return {
          error: error.message,
          migrationPending: isMigrationPendingError(error.message),
        };
      }
    }

    const feedbacks = state.feedbacks.slice(0, 20).map((f) => ({
      id: f.id,
      user_id: f.userId,
      workspace_id: f.workspaceId,
      artifact_id: f.discoveryId,
      kind: f.kind,
      note: f.note,
      visibility_scope: resolveVisibilityScope(f.visibilityScope),
      created_at: f.createdAt,
    }));
    if (feedbacks.length) {
      await supabase.from("aura_discovery_feedback").upsert(feedbacks, {
        onConflict: "id",
      });
    }

    const suppressions = state.suppressions.slice(0, 20).map((s) => ({
      id: s.id,
      user_id: s.userId,
      workspace_id: s.workspaceId,
      artifact_type: s.discoveryType,
      semantic_key: s.semanticKey,
      reason: s.reason,
      expires_at: s.expiresAt,
      created_at: s.createdAt,
      broken_at: s.brokenAt,
      break_reason: s.breakReason,
      visibility_scope: resolveVisibilityScope(s.visibilityScope),
    }));
    if (suppressions.length) {
      await supabase
        .from("aura_discovery_suppressions")
        .upsert(suppressions, { onConflict: "id" });
    }

    const audits = state.audits.slice(0, 20).map((a) => ({
      id: a.id,
      user_id: a.userId,
      workspace_id: a.workspaceId,
      action: a.action,
      artifact_id: a.discoveryId,
      actor: a.actor,
      previous_status: a.previousStatus,
      new_status: a.newStatus,
      justification: a.justification,
      correlation_id: a.correlationId,
      metadata: a.metadata as Database["public"]["Tables"]["aura_discovery_audit"]["Row"]["metadata"],
      created_at: a.createdAt,
    }));
    if (audits.length) {
      await supabase.from("aura_discovery_audit").upsert(audits, {
        onConflict: "id",
      });
    }

    if (run) {
      await persistRun(supabase, run);
    }

    return { error: null, migrationPending: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      error: msg,
      migrationPending: isMigrationPendingError(msg),
    };
  }
}

async function loadDiscoverySources(
  userId: string,
  workspaceId: string | null
): Promise<Parameters<typeof buildDiscoveryContextPure>[1]> {
  let cognitiveArtifacts: DiscoveryContext["cognitiveArtifacts"] = [];
  let memories: DiscoveryContext["memories"] = [];
  let worldEntities: DiscoveryContext["worldEntities"] = [];
  let worldRelationships: DiscoveryContext["worldRelationships"] = [];
  let missions: DiscoveryContext["missions"] = [];

  try {
    const arts = await listCognitiveArtifacts({
      limit: 40,
      includeArchived: false,
    });
    cognitiveArtifacts = arts
      .filter((a) => {
        // Do not feed private rows of others into Brain
        if (a.userId && a.userId !== userId) {
          const scope = resolveVisibilityScope(
            (a as { visibilityScope?: string }).visibilityScope,
            "PRIVATE"
          );
          return scope === "WORKSPACE" && a.workspaceId === workspaceId;
        }
        return true;
      })
      .map((a) => ({
        id: a.id,
        artifactType: a.artifactType,
        title: a.title,
        summary: a.summary,
        status: a.status,
        confidence: a.confidence,
        category: a.category,
      }));
  } catch {
    /* ignore */
  }

  try {
    const mems = await listMemories({ limit: 40 });
    memories = mems
      .filter((m) => {
        if (m.userId !== userId) {
          return (
            resolveVisibilityScope(
              (m as { visibilityScope?: string }).visibilityScope ??
                (m.consentScope === "workspace" ? "WORKSPACE" : "PRIVATE")
            ) === "WORKSPACE" && m.workspaceId === workspaceId
          );
        }
        return true;
      })
      .map((m) => ({
        id: m.id,
        memoryType: m.memoryType,
        title: m.title,
        status: m.status,
        confidence: m.confidence,
        summary: (m.content || m.title).slice(0, 280),
        createdAt: m.createdAt,
      }));
  } catch {
    /* ignore */
  }

  try {
    const entities = await listWorldEntities({ limit: 40 });
    worldEntities = entities.map((e) => ({
      id: e.id,
      entityType: String(e.entityType),
      displayName: e.displayName,
      status: e.status,
      confidence: e.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const rels = await listWorldRelationships({ limit: 40 });
    worldRelationships = rels.map((r) => ({
      id: r.id,
      relationshipType: String(r.relationshipType),
      sourceEntityId: r.sourceEntityId,
      targetEntityId: r.targetEntityId,
      status: r.status,
      confidence: r.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const stored = listStoredMissions(userId);
    missions = stored.slice(0, 20).map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      type: m.type,
      progress:
        typeof m.progress?.totalPct === "number" ? m.progress.totalPct : null,
    }));
  } catch {
    /* ignore */
  }

  void workspaceId;
  return {
    cognitiveArtifacts,
    memories,
    worldEntities,
    worldRelationships,
    missions,
  };
}

export async function buildDiscoveryContextForUser(input?: {
  maxItems?: number;
  correlationId?: string;
}): Promise<DiscoveryContext> {
  const ctx = await getDataContext();
  const sources = await loadDiscoverySources(
    ctx.userId,
    ctx.activeWorkspaceId ?? null
  );
  return buildDiscoveryContextPure(
    {
      userId: ctx.userId,
      workspaceId: ctx.activeWorkspaceId,
      maxItems: input?.maxItems ?? 40,
      correlationId: input?.correlationId,
    },
    sources
  );
}

export async function generateDiscoveries(input?: {
  dryRun?: boolean;
  maxArtifacts?: number;
}): Promise<{ artifacts: DiscoveryArtifact[]; error: string | null }> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  const context = await buildDiscoveryContextForUser({ maxItems: 40 });
  const result = generateDiscoveriesPure(state, context, {
    userId: ctx.userId,
    workspaceId: ws,
    dryRun: input?.dryRun,
    maxArtifacts: Math.min(input?.maxArtifacts ?? SAFE_BOOTSTRAP_MAX, SAFE_BOOTSTRAP_MAX),
  });
  if (!input?.dryRun) {
    await commit(
      ctx.userId,
      result.state,
      ctx.supabase,
      ws,
      result.data?.artifacts,
      result.data?.run
    );
  }
  return { artifacts: result.data?.artifacts ?? [], error: result.error };
}

export async function listDiscoveries(
  filters?: DiscoveryFilters
): Promise<DiscoveryArtifact[]> {
  const ctx = await getDataContext();
  const ws =
    filters?.workspaceId !== undefined
      ? filters.workspaceId
      : ctx.activeContext === "workspace"
        ? ctx.activeWorkspaceId
        : null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  return listDiscoveriesPure(state, ctx.userId, {
    ...filters,
    workspaceId: ws,
  });
}

export async function getDiscovery(
  id: string
): Promise<DiscoveryArtifact | null> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  return getDiscoveryPure(state, ctx.userId, id, ws);
}

export async function searchDiscoveries(
  query: string,
  limit = 20
): Promise<DiscoveryArtifact[]> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  return searchDiscoveriesPure(state, ctx.userId, query, limit);
}

export async function explainDiscoveryService(
  id: string
): Promise<DiscoveryExplanation | null> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  return explainDiscoveryPure(state, ctx.userId, id);
}

export async function submitDiscoveryFeedback(
  discoveryId: string,
  kind: DiscoveryFeedbackKind,
  note?: string | null,
  expectedVersion?: number
): Promise<{
  error: string | null;
  artifact?: DiscoveryArtifact;
  conflict?: boolean;
}> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  const result = submitDiscoveryFeedbackPure(state, {
    userId: ctx.userId,
    workspaceId: ws,
    discoveryId,
    kind,
    note,
    expectedVersion,
  });
  if (!result.ok || !result.data) {
    return {
      error: result.error,
      artifact: result.data?.artifact,
      conflict: result.data?.conflict,
    };
  }
  await commit(ctx.userId, result.state, ctx.supabase, ws, [
    result.data.artifact,
  ]);
  return { error: null, artifact: result.data.artifact };
}

export async function confirmDiscovery(
  discoveryId: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  const res = await submitDiscoveryFeedback(
    discoveryId,
    "confirm",
    undefined,
    expectedVersion
  );
  return { error: res.error, conflict: res.conflict };
}

export async function rejectDiscovery(
  discoveryId: string,
  reason?: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  const res = await submitDiscoveryFeedback(
    discoveryId,
    "reject",
    reason,
    expectedVersion
  );
  return { error: res.error, conflict: res.conflict };
}

export async function archiveDiscovery(
  discoveryId: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  const result = archiveDiscoveryPure(state, ctx.userId, discoveryId);
  if (!result.ok || !result.data) {
    return { error: result.error, conflict: result.data?.conflict };
  }
  if (
    expectedVersion != null &&
    result.data.artifact.rowVersion - 1 !== expectedVersion
  ) {
    // archivePure already bumped; re-check via feedback path preferred
  }
  await commit(ctx.userId, result.state, ctx.supabase, ws, [
    result.data.artifact,
  ]);
  return { error: null };
}

export async function suppressSimilarDiscoveries(
  discoveryId: string,
  reason?: string,
  expectedVersion?: number
): Promise<{ error: string | null; conflict?: boolean }> {
  const res = await submitDiscoveryFeedback(
    discoveryId,
    "suppress_similar",
    reason,
    expectedVersion
  );
  return { error: res.error, conflict: res.conflict };
}

export async function bootstrapDiscoveryEngine(input?: {
  dryRun?: boolean;
  maxItems?: number;
}): Promise<{ report: DiscoveryBootstrapReport; error: string | null }> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const { state, migrationPending } = await hydrate(
    ctx.userId,
    ctx.supabase,
    ws
  );

  if (migrationPending) {
    const correlationId = `mig_${Date.now().toString(36)}`;
    return {
      error: null,
      report: {
        dryRun: Boolean(input?.dryRun),
        artifactsGenerated: 0,
        suppressedCount: 0,
        reusedCount: 0,
        correlationId,
        outcome: "migration_pending",
        message:
          "Migration pendente — aplique as migrations Discovery/RC2.1 no Supabase.",
        durationMs: 0,
        metrics: {
          recordsAnalyzed: 0,
          artifactsDeduplicated: 0,
          artifactsSuppressed: 0,
          feedbacks: 0,
          failures: 1,
          timeouts: 0,
          cacheHit: false,
          detectorsExecuted: [],
        },
        items: [],
      },
    };
  }

  const sources = await loadDiscoverySources(ctx.userId, ws);
  const context = buildDiscoveryContextPure(
    {
      userId: ctx.userId,
      workspaceId: ws,
      maxItems: input?.maxItems ?? 40,
    },
    sources
  );
  const result = bootstrapDiscoveryEnginePure(state, {
    userId: ctx.userId,
    workspaceId: ws,
    dryRun: input?.dryRun,
    maxItems: Math.min(input?.maxItems ?? SAFE_BOOTSTRAP_MAX, SAFE_BOOTSTRAP_MAX),
    context,
  });

  if (!result.ok) {
    return {
      report: {
        dryRun: Boolean(input?.dryRun),
        artifactsGenerated: 0,
        suppressedCount: 0,
        reusedCount: 0,
        correlationId: context.correlationId,
        outcome: "error",
        message: result.error ?? "Falha ao atualizar descobertas",
        durationMs: 0,
        metrics: {
          recordsAnalyzed: 0,
          artifactsDeduplicated: 0,
          artifactsSuppressed: 0,
          feedbacks: 0,
          failures: 1,
          timeouts: 0,
          cacheHit: false,
          detectorsExecuted: [],
        },
        items: [],
      },
      error: result.error,
    };
  }

  if (!input?.dryRun) {
    const persist = await commit(
      ctx.userId,
      result.state,
      ctx.supabase,
      ws,
      result.data?.artifacts,
      result.state.runs[0] ?? null
    );
    if (persist.migrationPending) {
      return {
        error: null,
        report: {
          ...(result.data?.report as DiscoveryBootstrapReport),
          outcome: "migration_pending",
          message:
            "Migration pendente — aplique as migrations Discovery/RC2.1 no Supabase.",
        },
      };
    }
  }

  return {
    report: result.data!.report,
    error: null,
  };
}

export async function getDiscoveryContextForBrain(input?: {
  limit?: number;
}): Promise<DiscoveryBrainContext> {
  const ctx = await getDataContext();
  const cacheKey = discoveryCacheKey(
    ctx.userId,
    `brain:${input?.limit ?? 6}:${ctx.activeWorkspaceId ?? "personal"}`
  );
  const cached = getCachedDiscoveryRead<DiscoveryBrainContext>(cacheKey);
  if (cached) return cached;

  const ws =
    ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null;
  const { state } = await hydrate(ctx.userId, ctx.supabase, ws);
  const brain = getDiscoveryContextForBrainPure(state, ctx.userId, {
    limit: input?.limit ?? 6,
    workspaceId: ws,
  });
  setCachedDiscoveryRead(cacheKey, brain);
  return brain;
}

export async function getDiscoveryAuditLog(
  limit = 50
): Promise<DiscoveryAuditEvent[]> {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  await hydrate(ctx.userId, ctx.supabase, ws);
  return listDiscoveryAudits(stateKey(ctx.userId, ws), limit);
}

export async function getAuraTimeline(limit = 40): Promise<TimelineEvent[]> {
  const ctx = await getDataContext();
  const discoveries = await listDiscoveries({
    limit: 20,
    includeArchived: true,
  });

  let memories: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    userId?: string;
  }> = [];
  let insights: Array<{
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
  }> = [];
  let worldEntities: Array<{
    id: string;
    displayName: string;
    createdAt: string;
  }> = [];

  try {
    const mems = await listMemories({ limit: 15 });
    memories = mems.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.content?.slice(0, 120),
      createdAt: m.createdAt,
      userId: m.userId,
    }));
  } catch {
    /* ignore */
  }

  try {
    const arts = await listCognitiveArtifacts({ limit: 15 });
    insights = arts.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      createdAt: a.createdAt,
    }));
  } catch {
    /* ignore */
  }

  try {
    const entities = await listWorldEntities({ limit: 15 });
    worldEntities = entities.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      createdAt: e.createdAt,
    }));
  } catch {
    /* ignore */
  }

  return mergeTimelineSources({
    memories,
    worldEntities,
    insights,
    discoveries: discoveries.map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      createdAt: d.createdAt,
      type: d.type,
      actorUserId: d.userId,
      workspaceId: d.workspaceId,
    })),
    limit,
    workspaceId: ctx.activeWorkspaceId,
  });
}

export async function getAuraBrainTimeline(limit = 40) {
  const events = await getAuraTimeline(limit);
  return events.map((e) => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    summary: e.summary,
    at: e.occurredAt,
    href: e.href,
    sourceId: e.sourceId,
    actorUserId: e.actorUserId,
    layer: e.layer ?? e.kind,
    origin: e.origin,
    workspaceId: e.workspaceId,
    meta: e.meta,
  }));
}

export async function searchAuraBrain(
  query: string,
  limit = 30
): Promise<
  Array<{
    id: string;
    kind: string;
    title: string;
    summary: string;
    href: string;
    score: number;
  }>
> {
  const { searchAuraBrainSources } = await import("@/lib/discovery/search");
  const discoveries = await listDiscoveries({ limit: 40, includeArchived: false });
  let memories: Array<{ id: string; title: string; summary?: string }> = [];
  let insights: Array<{ id: string; title: string; summary?: string }> = [];
  let worldEntities: Array<{
    id: string;
    displayName: string;
    entityType?: string;
  }> = [];

  try {
    memories = (await listMemories({ limit: 30 })).map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.content?.slice(0, 160),
    }));
  } catch {
    /* ignore */
  }
  try {
    insights = (await listCognitiveArtifacts({ limit: 30 })).map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
    }));
  } catch {
    /* ignore */
  }
  try {
    worldEntities = (await listWorldEntities({ limit: 30 })).map((e) => ({
      id: e.id,
      displayName: e.displayName,
      entityType: String(e.entityType),
    }));
  } catch {
    /* ignore */
  }

  return searchAuraBrainSources(
    query,
    {
      memories,
      worldEntities,
      insights,
      discoveries: discoveries.map((d) => ({
        id: d.id,
        title: d.title,
        summary: d.summary,
      })),
    },
    limit
  );
}

export async function getDiscoveryDashboardSummary() {
  return getDiscoveryContextForBrain({ limit: 5 });
}
