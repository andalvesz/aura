/**
 * Memory Engine service — app facade (Sprint 6.3).
 * Public contracts: recordExperience, createMemory, get/list/search, promotion, brain context.
 */

import {
  applyBootstrapToMemoryState,
  type MemoryBootstrapInput,
  type MemoryBootstrapReport,
} from "@/lib/memory/bootstrap";
import {
  archiveMemoryPure,
  correctMemoryPure,
  createMemoryPure,
  deleteMemoryPure,
  disputeMemoryPure,
  evaluateMemoryForPromotion,
  expireMemoriesPure,
  explainMemoryPure,
  getContextualMemoriesPure,
  getMemoriesBySubjectPure,
  getMemoryContextForBrainPure,
  getMemoryPure,
  getMemoryTimelinePure,
  listMemoriesPure,
  markPromotionAppliedPure,
  recordExperiencePure,
  searchMemoriesPure,
  submitMemoryFeedbackPure,
  type MemoryEngineState,
} from "@/lib/memory/engine";
import {
  getCachedMemoryRead,
  getMemoryState,
  invalidateMemoryCache,
  listMemoryAudits,
  memoryCacheKey,
  setCachedMemoryRead,
  setMemoryState,
} from "@/lib/memory/store";
import type {
  CorrectMemoryInput,
  CreateMemoryInput,
  ExperienceRecord,
  MemoryAuditEvent,
  MemoryBrainContext,
  MemoryPromotionResult,
  MemoryRecord,
  MemorySearchFilters,
  MemoryTimelineEntry,
  RecordExperienceInput,
  SubmitMemoryFeedbackInput,
} from "@/lib/memory/types";
import { confidenceBand } from "@/lib/memory/confidence";
import { getDataContext } from "@/lib/supabase/services/context";
import { getAuraBrainSettings } from "@/lib/aura-brain/context";
import { listStoredMissions } from "@/lib/missions/mission-store";
import {
  createIdentityClaim,
  getIdentityClaims,
  observeIdentityEvidence,
} from "@/lib/supabase/services/identity-engine.service";

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
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

function loose(supabase: unknown): LooseClient {
  return supabase as LooseClient;
}

function memoryToRow(memory: MemoryRecord): Record<string, unknown> {
  return {
    id: memory.id,
    user_id: memory.userId,
    workspace_id: memory.workspaceId,
    memory_type: memory.memoryType,
    status: memory.status,
    title: memory.title,
    content: memory.content,
    structured_content: memory.structuredContent,
    source_type: memory.sourceType,
    source_reference: memory.sourceReference,
    evidence: memory.evidence,
    context: memory.context,
    subjects: memory.subjects,
    importance: memory.importance,
    confidence: memory.confidence,
    weight: memory.weight,
    sensitivity: memory.sensitivity,
    retention_policy: memory.retentionPolicy,
    valid_from: memory.validFrom,
    valid_until: memory.validUntil,
    occurred_at: memory.occurredAt,
    last_recalled_at: memory.lastRecalledAt,
    recall_count: memory.recallCount,
    supersedes_memory_id: memory.supersedesMemoryId,
    superseded_by_memory_id: memory.supersededByMemoryId,
    duplicate_of_memory_id: memory.duplicateOfMemoryId,
    promotion_status: memory.promotionStatus,
    experience_id: memory.experienceId,
    idempotency_key: memory.idempotencyKey,
    fingerprint: memory.fingerprint,
    semantic_key: memory.semanticKey,
    score_history: memory.scoreHistory,
    consent_scope: memory.consentScope,
    payload: memory,
    created_at: memory.createdAt,
    updated_at: memory.updatedAt,
    archived_at: memory.archivedAt,
    deleted_at: memory.deletedAt,
  };
}

function rowToMemory(row: Record<string, unknown>): MemoryRecord | null {
  const payload = row.payload as MemoryRecord | undefined;
  if (payload?.id && payload.title) {
    return {
      ...payload,
      confidenceBand:
        payload.confidenceBand ?? confidenceBand(payload.confidence),
    };
  }
  return null;
}

async function loadMemoriesFromDb(
  supabase: unknown,
  userId: string
): Promise<MemoryRecord[]> {
  try {
    const { data, error } = await loose(supabase)
      .from("aura_memories")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((r) => rowToMemory(r))
      .filter((m): m is MemoryRecord => Boolean(m));
  } catch {
    return [];
  }
}

async function persistMemory(
  supabase: unknown,
  memory: MemoryRecord
): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_memories")
      .upsert(memoryToRow(memory), { onConflict: "id" });
  } catch {
    // best-effort
  }
}

async function persistDelete(
  supabase: unknown,
  userId: string,
  memoryId: string
): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_memories")
      .delete()
      .eq("user_id", userId)
      .eq("id", memoryId);
  } catch {
    // best-effort
  }
}

async function persistAudit(
  supabase: unknown,
  event: MemoryAuditEvent
): Promise<void> {
  try {
    await loose(supabase).from("aura_memory_audit").insert({
      id: event.id,
      user_id: event.userId,
      workspace_id: event.workspaceId,
      memory_id: event.memoryId,
      experience_id: event.experienceId,
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

async function hydrateUserState(
  userId: string,
  supabase: unknown
): Promise<MemoryEngineState> {
  let state = getMemoryState(userId);
  if (state.memories.length === 0) {
    const fromDb = await loadMemoriesFromDb(supabase, userId);
    if (fromDb.length > 0) {
      state = { ...state, memories: fromDb };
      setMemoryState(userId, state);
    }
  }
  return expireMemoriesPure(state, userId);
}

async function commitState(
  userId: string,
  state: MemoryEngineState,
  supabase: unknown,
  changedIds: string[],
  deletedIds: string[] = []
): Promise<void> {
  setMemoryState(userId, state);
  invalidateMemoryCache(userId);
  for (const id of changedIds) {
    const memory = state.memories.find((m) => m.id === id);
    if (memory) await persistMemory(supabase, memory);
  }
  for (const id of deletedIds) {
    await persistDelete(supabase, userId, id);
  }
  for (const a of state.audits.slice(0, 8)) {
    await persistAudit(supabase, a);
  }
}

function workspaceFromCtx(
  ctx: Awaited<ReturnType<typeof getDataContext>>,
  explicit?: string | null
): string | null {
  if (explicit !== undefined) return explicit;
  return ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null;
}

export async function recordExperience(
  input: RecordExperienceInput
): Promise<{
  experience: ExperienceRecord | null;
  memory: MemoryRecord | null;
  error: string | null;
}> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = recordExperiencePure(state, ctx.userId, {
    ...input,
    workspaceId: workspaceFromCtx(ctx, input.workspaceId),
  });
  if (!res.ok || !res.data) {
    return { experience: null, memory: null, error: res.error };
  }
  const changed = res.data.memory ? [res.data.memory.id] : [];
  await commitState(ctx.userId, res.state, ctx.supabase, changed);
  return {
    experience: res.data.experience,
    memory: res.data.memory,
    error: null,
  };
}

export async function createMemory(
  input: CreateMemoryInput
): Promise<{ memory: MemoryRecord | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = createMemoryPure(state, ctx.userId, {
    ...input,
    workspaceId: workspaceFromCtx(ctx, input.workspaceId),
  });
  if (!res.ok || !res.data) return { memory: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { memory: res.data, error: null };
}

export async function getMemory(
  memoryId: string
): Promise<MemoryRecord | null> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return getMemoryPure(state, ctx.userId, memoryId);
}

export async function listMemories(
  filters?: MemorySearchFilters
): Promise<MemoryRecord[]> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return listMemoriesPure(state, ctx.userId, {
    ...filters,
    workspaceId: workspaceFromCtx(ctx, filters?.workspaceId),
  });
}

export async function searchMemories(
  filters?: MemorySearchFilters
): Promise<{ items: MemoryRecord[]; nextCursor: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return searchMemoriesPure(state, ctx.userId, {
    ...filters,
    workspaceId: workspaceFromCtx(ctx, filters?.workspaceId),
  });
}

export async function getContextualMemories(input?: {
  context?: string;
  workspaceId?: string | null;
  limit?: number;
  markRecall?: boolean;
}): Promise<MemoryRecord[]> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = getContextualMemoriesPure(state, ctx.userId, {
    ...input,
    workspaceId: workspaceFromCtx(ctx, input?.workspaceId),
  });
  if (input?.markRecall) {
    await commitState(
      ctx.userId,
      res.state,
      ctx.supabase,
      (res.data ?? []).map((m) => m.id)
    );
  }
  return res.data ?? [];
}

export async function getMemoriesBySubject(
  subjectType: string,
  subjectId: string
): Promise<MemoryRecord[]> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return getMemoriesBySubjectPure(state, ctx.userId, subjectType, subjectId);
}

export async function getMemoryTimeline(
  filters?: MemorySearchFilters
): Promise<MemoryTimelineEntry[]> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return getMemoryTimelinePure(state, ctx.userId, {
    ...filters,
    workspaceId: workspaceFromCtx(ctx, filters?.workspaceId),
  });
}

export async function explainMemory(memoryId: string): Promise<{
  explanation: string | null;
  memory: MemoryRecord | null;
  error: string | null;
}> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = explainMemoryPure(state, ctx.userId, memoryId);
  if (!res.ok) return { explanation: null, memory: null, error: "Não encontrada" };
  return { explanation: res.explanation, memory: res.memory, error: null };
}

export async function correctMemory(
  input: CorrectMemoryInput
): Promise<{ memory: MemoryRecord | null; error: string | null }> {
  const ctx = await getDataContext();
  if (!input.reason?.trim()) return { memory: null, error: "Motivo obrigatório" };
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = correctMemoryPure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { memory: null, error: res.error };
  const changed = res.state.memories
    .filter(
      (m) =>
        m.id === res.data!.id ||
        m.id === input.memoryId ||
        m.supersededByMemoryId === res.data!.id
    )
    .map((m) => m.id);
  await commitState(ctx.userId, res.state, ctx.supabase, changed);
  return { memory: res.data, error: null };
}

export async function disputeMemory(
  memoryId: string,
  reason: string
): Promise<{ memory: MemoryRecord | null; error: string | null }> {
  const ctx = await getDataContext();
  if (!reason?.trim()) return { memory: null, error: "Motivo obrigatório" };
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = disputeMemoryPure(state, ctx.userId, memoryId, reason);
  if (!res.ok || !res.data) return { memory: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { memory: res.data, error: null };
}

export async function archiveMemory(
  memoryId: string,
  reason?: string
): Promise<{ memory: MemoryRecord | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = archiveMemoryPure(state, ctx.userId, memoryId, reason);
  if (!res.ok || !res.data) return { memory: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { memory: res.data, error: null };
}

export async function deleteMemory(
  memoryId: string,
  reason?: string,
  hard = false
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = deleteMemoryPure(state, ctx.userId, memoryId, reason, hard);
  if (!res.ok) return { error: res.error };
  await commitState(
    ctx.userId,
    res.state,
    ctx.supabase,
    hard ? [] : [memoryId],
    hard ? [memoryId] : []
  );
  return { error: null };
}

export async function submitMemoryFeedback(
  input: SubmitMemoryFeedbackInput
): Promise<{ memory: MemoryRecord | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = submitMemoryFeedbackPure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { memory: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.memory.id]);
  return { memory: res.data.memory, error: null };
}

async function identitySnapshotForUser(): Promise<{
  existingClaims: Array<{
    key: string;
    status: string;
    category: string;
    value: unknown;
  }>;
}> {
  try {
    const claims = await getIdentityClaims({
      includeRejected: true,
      includeArchived: true,
    });
    return {
      existingClaims: claims.map((c) => ({
        key: c.key,
        status: c.status,
        category: c.category,
        value: c.value,
      })),
    };
  } catch {
    return { existingClaims: [] };
  }
}

export async function evaluateMemoryPromotion(
  memoryId: string
): Promise<{ result: MemoryPromotionResult | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const identity = await identitySnapshotForUser();
  const res = evaluateMemoryForPromotion(state, ctx.userId, memoryId, identity);
  if (!res.ok || !res.data) return { result: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [memoryId]);
  return { result: res.data, error: null };
}

/**
 * Apply promotion via Identity public contracts only.
 * Never silently confirms hypotheses. Never reactivates rejected claims.
 */
export async function promoteMemory(memoryId: string): Promise<{
  result: MemoryPromotionResult | null;
  identityClaimId: string | null;
  error: string | null;
}> {
  const evaluated = await evaluateMemoryPromotion(memoryId);
  if (!evaluated.result) {
    return { result: null, identityClaimId: null, error: evaluated.error };
  }
  const result = evaluated.result;

  if (
    result.decision !== "PROPOSE_IDENTITY_CLAIM" &&
    result.decision !== "ATTACH_IDENTITY_EVIDENCE"
  ) {
    return { result, identityClaimId: null, error: null };
  }

  if (result.requiresUserConfirmation && result.decision === "PROPOSE_IDENTITY_CLAIM") {
    // Queue only — do not auto-confirm
    const ctx = await getDataContext();
    const state = await hydrateUserState(ctx.userId, ctx.supabase);
    const marked = markPromotionAppliedPure(
      state,
      ctx.userId,
      memoryId,
      "PROPOSE_IDENTITY_CLAIM"
    );
    if (marked.ok) {
      await commitState(ctx.userId, marked.state, ctx.supabase, [memoryId]);
    }
    return { result, identityClaimId: null, error: null };
  }

  const target = result.target;
  if (!target?.key || !target.label) {
    return {
      result,
      identityClaimId: null,
      error: "Alvo de promoção incompleto",
    };
  }

  if (result.decision === "ATTACH_IDENTITY_EVIDENCE") {
    const obs = await observeIdentityEvidence({
      category: (target.category as never) || "preference",
      key: target.key,
      value: target.value,
      label: target.label,
      sourceType: "memory_engine",
      sourceReference: {
        entityType: "memory",
        entityId: memoryId,
      },
      evidenceSummary: `Evidência da memória ${memoryId}`,
      evidenceStrength: Math.min(60, result.promotionConfidence),
    });
    const ctx = await getDataContext();
    const state = await hydrateUserState(ctx.userId, ctx.supabase);
    const marked = markPromotionAppliedPure(
      state,
      ctx.userId,
      memoryId,
      "ATTACH_IDENTITY_EVIDENCE"
    );
    if (marked.ok) {
      await commitState(ctx.userId, marked.state, ctx.supabase, [memoryId]);
    }
    return {
      result,
      identityClaimId: obs.claim?.id ?? null,
      error: obs.error,
    };
  }

  // Propose claim — only auto-create when memory already CONFIRMED (user authority)
  const mem = await getMemory(memoryId);
  const confirmNow = mem?.status === "CONFIRMED";
  const created = await createIdentityClaim({
    category: (target.category as never) || "preference",
    key: target.key,
    value: target.value,
    label: target.label,
    description: result.reason,
    sourceType: "memory_engine",
    sourceReference: {
      entityType: "memory",
      entityId: memoryId,
    },
    confidence: result.promotionConfidence,
    confirmNow,
    evidenceSummary: `Proposta a partir da memória ${memoryId}`,
  });

  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const marked = markPromotionAppliedPure(
    state,
    ctx.userId,
    memoryId,
    "PROPOSE_IDENTITY_CLAIM"
  );
  if (marked.ok) {
    await commitState(ctx.userId, marked.state, ctx.supabase, [memoryId]);
  }

  return {
    result,
    identityClaimId: created.claim?.id ?? null,
    error: created.error,
  };
}

export async function getMemoryContextForBrain(input?: {
  context?: string;
  workspaceId?: string | null;
  limit?: number;
}): Promise<MemoryBrainContext> {
  const ctx = await getDataContext();
  const ck = memoryCacheKey(
    ctx.userId,
    workspaceFromCtx(ctx, input?.workspaceId),
    `brain:${input?.context ?? "all"}`
  );
  const cached = getCachedMemoryRead<MemoryBrainContext>(ck);
  if (cached) return cached;

  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const brain = getMemoryContextForBrainPure(state, ctx.userId, {
    ...input,
    workspaceId: workspaceFromCtx(ctx, input?.workspaceId),
  });
  setCachedMemoryRead(ck, brain);
  return brain;
}

export async function bootstrapMemoryFromConfirmedData(
  options?: Partial<MemoryBootstrapInput>
): Promise<{ report: MemoryBootstrapReport; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  let confirmedClaims: MemoryBootstrapInput["confirmedIdentityClaims"] = [];
  try {
    const claims = await getIdentityClaims({ includeRejected: false });
    confirmedClaims = claims
      .filter((c) => c.status === "CONFIRMED")
      .map((c) => ({
        key: c.key,
        label: c.label,
        value: c.value,
        category: c.category,
      }));
  } catch {
    confirmedClaims = [];
  }

  const missions = listStoredMissions(ctx.userId);
  const settings = getAuraBrainSettings(ctx.userId);

  const { state: next, report } = applyBootstrapToMemoryState(state, ctx.userId, {
    userId: ctx.userId,
    fullName: profile?.full_name,
    preferredLanguage: null,
    confirmedIdentityClaims: confirmedClaims,
    explicitMissionSummaries: missions.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      createdAt: m.createdAt,
    })),
    dryRun: options?.dryRun,
    maxItems: options?.maxItems ?? 40,
    ...options,
  });

  // silence unused — settings reserved for future preference bootstrap
  void settings;

  if (!options?.dryRun && report.applied > 0) {
    await commitState(
      ctx.userId,
      next,
      ctx.supabase,
      next.memories.map((m) => m.id)
    );
  }

  return { report, error: null };
}

export async function getMemoryAuditLog(
  limit = 40
): Promise<MemoryAuditEvent[]> {
  const ctx = await getDataContext();
  await hydrateUserState(ctx.userId, ctx.supabase);
  return listMemoryAudits(ctx.userId, limit);
}
