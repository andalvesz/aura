/**
 * Cognitive Engine service — app facade (Sprint 6.5).
 */

import {
  archiveCognitiveArtifactPure,
  bootstrapCognitiveEnginePure,
  buildCognitiveContextPure,
  deleteCognitiveArtifactPure,
  explainCognitiveArtifactPure,
  generateCognitiveArtifactsPure,
  getCognitiveArtifactPure,
  getCognitiveContextForBrainPure,
  listCognitiveArtifactsPure,
  revalidateCognitiveArtifactPure,
  searchCognitiveArtifactsPure,
  submitCognitiveFeedbackPure,
  type CognitiveEngineState,
} from "@/lib/cognitive/engine";
import {
  cognitiveCacheKey,
  getCachedCognitiveRead,
  getCognitiveState,
  invalidateCognitiveCache,
  listCognitiveAudits,
  setCachedCognitiveRead,
  setCognitiveState,
} from "@/lib/cognitive/store";
import { confidenceBand } from "@/lib/cognitive/confidence";
import type {
  ArtifactFilters,
  CognitiveArtifact,
  CognitiveAuditEvent,
  CognitiveBrainContext,
  CognitiveBootstrapReport,
  CognitiveContext,
  CognitiveExplanation,
  FeedbackKind,
  GenerateOptions,
} from "@/lib/cognitive/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { getIdentityClaims } from "@/lib/supabase/services/identity-engine.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import { listWorldEntities } from "@/lib/supabase/services/world-model.service";
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

function artifactToRow(a: CognitiveArtifact): Record<string, unknown> {
  return {
    id: a.id,
    user_id: a.userId,
    workspace_id: a.workspaceId,
    artifact_type: a.artifactType,
    category: a.category,
    status: a.status,
    title: a.title,
    summary: a.summary,
    structured_content: a.structuredContent,
    confidence: a.confidence,
    importance: a.importance,
    sensitivity: a.sensitivity,
    method: a.method,
    method_version: a.methodVersion,
    fingerprint: a.fingerprint,
    evidence_set_hash: a.evidenceSetHash,
    suppression_key: a.suppressionKey,
    time_range: a.timeRange,
    valid_from: a.validFrom,
    valid_until: a.validUntil,
    first_generated_at: a.firstGeneratedAt,
    last_validated_at: a.lastValidatedAt,
    supersedes_artifact_id: a.supersedesArtifactId,
    superseded_by_artifact_id: a.supersededByArtifactId,
    generated_by: a.generatedBy,
    provider_metadata: a.providerMetadata,
    execution_influence: "none",
    subject_references: a.subjectReferences,
    entity_references: a.entityReferences,
    payload: a,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    archived_at: a.archivedAt,
    deleted_at: a.deletedAt,
  };
}

function rowToArtifact(row: Record<string, unknown>): CognitiveArtifact | null {
  const payload = row.payload as CognitiveArtifact | undefined;
  if (payload?.id && payload.fingerprint) {
    return {
      ...payload,
      confidenceBand:
        payload.confidenceBand ?? confidenceBand(payload.confidence),
      executionInfluence: "none",
    };
  }
  return null;
}

async function loadFromDb(
  supabase: unknown,
  userId: string
): Promise<CognitiveArtifact[]> {
  try {
    const { data, error } = await loose(supabase)
      .from("aura_cognitive_artifacts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((r) => rowToArtifact(r))
      .filter((a): a is CognitiveArtifact => Boolean(a));
  } catch {
    return [];
  }
}

async function hydrate(
  userId: string,
  supabase: unknown
): Promise<CognitiveEngineState> {
  let state = getCognitiveState(userId);
  if (state.artifacts.length === 0) {
    const artifacts = await loadFromDb(supabase, userId);
    if (artifacts.length) {
      state = { ...state, artifacts };
      setCognitiveState(userId, state);
    }
  }
  return state;
}

async function commit(
  userId: string,
  state: CognitiveEngineState,
  supabase: unknown,
  changed?: CognitiveArtifact[]
): Promise<void> {
  setCognitiveState(userId, state);
  invalidateCognitiveCache(userId);
  try {
    const rows = (changed ?? state.artifacts.slice(0, 40)).map(artifactToRow);
    if (rows.length) {
      await loose(supabase)
        .from("aura_cognitive_artifacts")
        .upsert(rows, { onConflict: "id" });
    }
    const audits = state.audits.slice(0, 20).map((a) => ({
      id: a.id,
      user_id: a.userId,
      workspace_id: a.workspaceId,
      action: a.action,
      artifact_id: a.artifactId,
      actor: a.actor,
      previous_status: a.previousStatus,
      new_status: a.newStatus,
      method: a.method,
      method_version: a.methodVersion,
      provider: a.provider,
      validator_disposition: a.validatorDisposition,
      justification: a.justification,
      correlation_id: a.correlationId,
      source_references: a.sourceReferences,
      metadata: a.metadata,
      created_at: a.createdAt,
    }));
    if (audits.length) {
      await loose(supabase).from("aura_cognitive_audit").insert(audits);
    }
  } catch {
    // best-effort persistence
  }
}

async function loadSourceContext(userId: string, workspaceId: string | null) {
  let identityClaims: CognitiveContext["identityContext"]["claims"] = [];
  let memories: CognitiveContext["memoryContext"]["memories"] = [];
  let worldEntities: CognitiveContext["worldContext"]["entities"] = [];
  let worldRelationships: CognitiveContext["worldContext"]["relationships"] = [];
  let missions: CognitiveContext["missionContext"]["missions"] = [];

  try {
    const claims = await getIdentityClaims();
    identityClaims = claims.slice(0, 40).map((c) => ({
      id: c.id,
      category: c.category,
      key: c.key,
      value: String(c.value ?? ""),
      status: c.status,
      confidence: c.confidence,
      contextScope: c.contextScope ?? "general",
    }));
  } catch {
    /* ignore */
  }

  try {
    const mems = await listMemories({ limit: 40 });
    memories = mems.map((m) => ({
      id: m.id,
      memoryType: m.memoryType,
      title: m.title,
      status: m.status,
      confidence: m.confidence,
      summary: (m.content || m.title).slice(0, 280),
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
  void worldRelationships;
  return {
    identityClaims,
    memories,
    worldEntities,
    worldRelationships,
    missions,
  };
}

export async function buildCognitiveContextForUser(input?: {
  maxItems?: number;
  correlationId?: string;
}): Promise<CognitiveContext> {
  const ctx = await getDataContext();
  const sources = await loadSourceContext(
    ctx.userId,
    ctx.activeWorkspaceId ?? null
  );
  return buildCognitiveContextPure(
    {
      userId: ctx.userId,
      workspaceId: ctx.activeWorkspaceId,
      maxItems: input?.maxItems ?? 40,
      correlationId: input?.correlationId,
    },
    sources
  );
}

export async function generateCognitiveArtifacts(
  options?: GenerateOptions
): Promise<{
  artifacts: CognitiveArtifact[];
  error: string | null;
}> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const context = await buildCognitiveContextForUser({
    correlationId: options?.correlationId,
  });
  const result = generateCognitiveArtifactsPure(state, context, {
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    ...options,
  });
  if (!options?.dryRun) {
    await commit(ctx.userId, result.state, ctx.supabase, result.data?.artifacts);
  }
  return {
    artifacts: result.data?.artifacts ?? [],
    error: result.error,
  };
}

export async function listCognitiveArtifacts(
  filters?: ArtifactFilters
): Promise<CognitiveArtifact[]> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return listCognitiveArtifactsPure(state, ctx.userId, {
    ...filters,
    workspaceId:
      filters?.workspaceId !== undefined
        ? filters.workspaceId
        : ctx.activeContext === "workspace"
          ? ctx.activeWorkspaceId
          : null,
  });
}

export async function getCognitiveArtifact(
  artifactId: string
): Promise<CognitiveArtifact | null> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return getCognitiveArtifactPure(state, ctx.userId, artifactId);
}

export async function searchCognitiveArtifacts(
  query: string,
  limit = 20
): Promise<CognitiveArtifact[]> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return searchCognitiveArtifactsPure(state, ctx.userId, query, limit);
}

export async function explainCognitiveArtifactService(
  artifactId: string
): Promise<CognitiveExplanation | null> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  return explainCognitiveArtifactPure(state, ctx.userId, artifactId);
}

export async function submitCognitiveFeedback(
  artifactId: string,
  kind: FeedbackKind,
  note?: string | null,
  correctionPayload?: Record<string, unknown> | null
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const result = submitCognitiveFeedbackPure(
    state,
    ctx.userId,
    artifactId,
    kind,
    note,
    correctionPayload
  );
  if (!result.ok || !result.data) {
    return { error: result.error ?? "feedback_failed" };
  }
  await commit(ctx.userId, result.state, ctx.supabase, [result.data.artifact]);
  return { error: null };
}

export async function confirmCognitiveArtifact(
  artifactId: string
): Promise<{ error: string | null }> {
  return submitCognitiveFeedback(artifactId, "confirm");
}

export async function rejectCognitiveArtifact(
  artifactId: string,
  note?: string
): Promise<{ error: string | null }> {
  return submitCognitiveFeedback(artifactId, "reject", note);
}

export async function correctCognitiveArtifact(
  artifactId: string,
  correction: { title?: string; summary?: string }
): Promise<{ error: string | null }> {
  return submitCognitiveFeedback(artifactId, "correct", null, correction);
}

export async function archiveCognitiveArtifact(
  artifactId: string
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const result = archiveCognitiveArtifactPure(state, ctx.userId, artifactId);
  if (!result.ok || !result.data) return { error: result.error };
  await commit(ctx.userId, result.state, ctx.supabase, [result.data]);
  return { error: null };
}

export async function deleteCognitiveArtifact(
  artifactId: string
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const result = deleteCognitiveArtifactPure(state, ctx.userId, artifactId);
  if (!result.ok || !result.data) return { error: result.error };
  await commit(ctx.userId, result.state, ctx.supabase, [result.data]);
  return { error: null };
}

export async function suppressSimilarArtifacts(
  artifactId: string,
  reason?: string
): Promise<{ error: string | null }> {
  return submitCognitiveFeedback(artifactId, "suppress_similar", reason);
}

export async function revalidateCognitiveArtifact(
  artifactId: string
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const context = await buildCognitiveContextForUser();
  const result = revalidateCognitiveArtifactPure(
    state,
    ctx.userId,
    artifactId,
    context
  );
  if (!result.ok || !result.data) return { error: result.error };
  await commit(ctx.userId, result.state, ctx.supabase, [result.data]);
  return { error: null };
}

export async function bootstrapCognitiveEngine(input?: {
  dryRun?: boolean;
  maxItems?: number;
}): Promise<{ report: CognitiveBootstrapReport; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrate(ctx.userId, ctx.supabase);
  const sources = await loadSourceContext(
    ctx.userId,
    ctx.activeWorkspaceId ?? null
  );
  const result = bootstrapCognitiveEnginePure(state, {
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    dryRun: input?.dryRun,
    maxItems: input?.maxItems ?? 20,
    ...sources,
  });
  if (!input?.dryRun) {
    await commit(
      ctx.userId,
      result.state,
      ctx.supabase,
      result.data?.artifacts
    );
  }
  return {
    report:
      result.data?.report ?? {
        dryRun: Boolean(input?.dryRun),
        artifactsGenerated: 0,
        insufficientCount: 0,
        blockedCount: 0,
        reusedCount: 0,
        items: [],
      },
    error: result.error,
  };
}

export async function getCognitiveContextForBrain(input?: {
  limit?: number;
}): Promise<CognitiveBrainContext> {
  const ctx = await getDataContext();
  const cacheKey = cognitiveCacheKey(
    ctx.userId,
    ctx.activeWorkspaceId,
    `brain:${input?.limit ?? 6}`
  );
  const cached = getCachedCognitiveRead<CognitiveBrainContext>(cacheKey);
  if (cached) return cached;

  const state = await hydrate(ctx.userId, ctx.supabase);
  const brain = getCognitiveContextForBrainPure(state, ctx.userId, {
    limit: input?.limit ?? 6,
    workspaceId:
      ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null,
  });
  setCachedCognitiveRead(cacheKey, brain);
  return brain;
}

export async function getCognitiveAuditLog(
  limit = 50
): Promise<CognitiveAuditEvent[]> {
  const ctx = await getDataContext();
  await hydrate(ctx.userId, ctx.supabase);
  return listCognitiveAudits(ctx.userId, limit);
}
