/**
 * Identity Engine service — app facade (Sprint 6.2).
 * Distinct from legacy identity.service.ts (legado context helpers).
 *
 * Public contracts: getIdentityProfile, getIdentityClaims, mutations.
 */

import { applyBootstrapToState } from "@/lib/identity/bootstrap";
import {
  archiveIdentityClaimPure,
  confirmIdentityClaimPure,
  correctIdentityClaimPure,
  createIdentityClaimPure,
  deleteIdentityClaimPure,
  explainIdentityClaimPure,
  getIdentityClaimsPure,
  getIdentityProfilePure,
  observeIdentityEvidencePure,
  rejectIdentityClaimPure,
  type IdentityEngineState,
} from "@/lib/identity/engine";
import {
  getCachedIdentityProfile,
  getIdentityState,
  invalidateIdentityProfileCache,
  listIdentityAudits,
  profileCacheKey,
  setCachedIdentityProfile,
  setIdentityState,
} from "@/lib/identity/store";
import type {
  CorrectIdentityClaimInput,
  CreateIdentityClaimInput,
  IdentityAuditEvent,
  IdentityClaim,
  IdentityContextScope,
  IdentityProfile,
  ObserveIdentityEvidenceInput,
} from "@/lib/identity/types";
import { confidenceBand } from "@/lib/identity/confidence";
import { getAuraBrainSettings } from "@/lib/aura-brain/context";
import {
  assertPersonalSubject,
  shortUserIdHash,
} from "@/lib/context/resolved-user-context";
import { getDataContext } from "@/lib/supabase/services/context";
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
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
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

function claimToRow(claim: IdentityClaim): Record<string, unknown> {
  return {
    id: claim.id,
    user_id: claim.userId,
    workspace_id: claim.workspaceId,
    category: claim.category,
    key: claim.key,
    value: claim.value,
    value_type: claim.valueType,
    label: claim.label,
    description: claim.description,
    status: claim.status,
    confidence: claim.confidence,
    weight: claim.weight,
    context_scope: claim.contextScope,
    source_type: claim.sourceType,
    source_reference: claim.sourceReference,
    evidence: claim.evidence,
    confidence_history: claim.confidenceHistory,
    confirmed_by: claim.confirmedBy,
    confirmed_at: claim.confirmedAt,
    rejected_by: claim.rejectedBy,
    rejected_at: claim.rejectedAt,
    rejection_reason: claim.rejectionReason,
    valid_from: claim.validFrom,
    valid_until: claim.validUntil,
    last_observed_at: claim.lastObservedAt,
    sensitivity: claim.sensitivity,
    conflict_group_id: claim.conflictGroupId,
    payload: claim,
    created_at: claim.createdAt,
    updated_at: claim.updatedAt,
    archived_at: claim.archivedAt,
  };
}

function rowToClaim(row: Record<string, unknown>): IdentityClaim | null {
  const payload = row.payload as IdentityClaim | undefined;
  if (payload?.id && payload.key) {
    return {
      ...payload,
      confidenceBand: payload.confidenceBand ?? confidenceBand(payload.confidence),
    };
  }
  return null;
}

async function loadClaimsFromDb(
  supabase: unknown,
  userId: string
): Promise<IdentityClaim[]> {
  try {
    const { data, error } = await loose(supabase)
      .from("aura_identity_claims")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error || !data) return [];
    return data
      .map((r) => rowToClaim(r))
      .filter((c): c is IdentityClaim => Boolean(c));
  } catch {
    return [];
  }
}

async function persistClaim(supabase: unknown, claim: IdentityClaim): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_identity_claims")
      .upsert(claimToRow(claim), { onConflict: "id" });
  } catch {
    // best-effort
  }
}

async function persistDelete(
  supabase: unknown,
  userId: string,
  claimId: string
): Promise<void> {
  try {
    await loose(supabase)
      .from("aura_identity_claims")
      .delete()
      .eq("user_id", userId)
      .eq("id", claimId);
  } catch {
    // best-effort
  }
}

async function persistAudit(
  supabase: unknown,
  event: IdentityAuditEvent
): Promise<void> {
  try {
    await loose(supabase).from("aura_identity_audit").insert({
      id: event.id,
      user_id: event.userId,
      workspace_id: event.workspaceId,
      claim_id: event.claimId,
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
): Promise<IdentityEngineState> {
  let state = getIdentityState(userId);
  if (state.claims.length === 0) {
    const fromDb = await loadClaimsFromDb(supabase, userId);
    if (fromDb.length > 0) {
      state = { ...state, claims: fromDb };
      setIdentityState(userId, state);
    }
  }
  return state;
}

async function commitState(
  userId: string,
  state: IdentityEngineState,
  supabase: unknown,
  changedClaimIds: string[],
  deletedIds: string[] = []
): Promise<void> {
  setIdentityState(userId, state);
  invalidateIdentityProfileCache(userId);
  for (const id of changedClaimIds) {
    const claim = state.claims.find((c) => c.id === id);
    if (claim) await persistClaim(supabase, claim);
  }
  for (const id of deletedIds) {
    await persistDelete(supabase, userId, id);
  }
  for (const a of state.audits.slice(0, 5)) {
    await persistAudit(supabase, a);
  }
}

export async function getIdentityProfile(options?: {
  contextScope?: IdentityContextScope | "all";
  workspaceId?: string | null;
  skipCache?: boolean;
  bootstrap?: boolean;
}): Promise<IdentityProfile> {
  const ctx = await getDataContext();
  const workspaceId =
    options?.workspaceId !== undefined
      ? options.workspaceId
      : ctx.activeContext === "workspace"
        ? ctx.activeWorkspaceId
        : null;
  const contextScope = options?.contextScope ?? "all";
  const ck = profileCacheKey(ctx.userId, workspaceId, contextScope);

  if (!options?.skipCache) {
    const cached = getCachedIdentityProfile<IdentityProfile>(ck);
    if (cached) return cached;
  }

  let state = await hydrateUserState(ctx.userId, ctx.supabase);

  if (options?.bootstrap !== false && state.claims.length === 0) {
    state = await runBootstrapInternal(ctx, state);
  }

  const profile = getIdentityProfilePure(state, ctx.userId, {
    workspaceId,
    contextScope,
  });
  setCachedIdentityProfile(ck, profile);
  return profile;
}

async function runBootstrapInternal(
  ctx: Awaited<ReturnType<typeof getDataContext>>,
  state: IdentityEngineState
): Promise<IdentityEngineState> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  const settings = getAuraBrainSettings(ctx.userId);
  const missions = listStoredMissions(ctx.userId);
  const types = [
    ...new Set(missions.map((m) => m.type).filter(Boolean)),
  ] as string[];

  const next = applyBootstrapToState(state, ctx.userId, {
    userId: ctx.userId,
    fullName: profile?.full_name,
    email: ctx.user.email,
    preferredLanguage: null,
    defaultAutonomyLevel: settings.defaultAutonomyLevel,
    explicitMissionTypes: types,
  });

  if (next.claims.length !== state.claims.length) {
    await commitState(
      ctx.userId,
      next,
      ctx.supabase,
      next.claims.map((c) => c.id)
    );
  }
  return next;
}

export async function getIdentityClaims(options?: {
  includeRejected?: boolean;
  includeArchived?: boolean;
  workspaceId?: string | null;
}): Promise<IdentityClaim[]> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  return getIdentityClaimsPure(state, ctx.userId, {
    includeRejected: options?.includeRejected,
    includeArchived: options?.includeArchived,
    workspaceId:
      options?.workspaceId !== undefined
        ? options.workspaceId
        : ctx.activeContext === "workspace"
          ? ctx.activeWorkspaceId
          : null,
  });
}

export async function createIdentityClaim(
  input: CreateIdentityClaimInput
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  if (input.workspaceId && input.workspaceId !== ctx.activeWorkspaceId) {
    if (ctx.activeContext !== "workspace" || !ctx.activeWorkspaceId) {
      return { claim: null, error: "Workspace inválido para claim" };
    }
  }
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = createIdentityClaimPure(state, ctx.userId, {
    ...input,
    workspaceId:
      input.workspaceId ??
      (ctx.activeContext === "workspace" ? ctx.activeWorkspaceId : null),
  });
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function observeIdentityEvidence(
  input: ObserveIdentityEvidenceInput
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = observeIdentityEvidencePure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function confirmIdentityClaim(
  claimId: string,
  reason?: string
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = confirmIdentityClaimPure(state, ctx.userId, claimId, reason);
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function rejectIdentityClaim(
  claimId: string,
  reason: string
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  if (!reason?.trim()) return { claim: null, error: "Motivo obrigatório" };
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = rejectIdentityClaimPure(state, ctx.userId, claimId, reason);
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function correctIdentityClaim(
  input: CorrectIdentityClaimInput
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  if (!input.reason?.trim()) return { claim: null, error: "Motivo obrigatório" };
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = correctIdentityClaimPure(state, ctx.userId, input);
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function archiveIdentityClaim(
  claimId: string,
  reason?: string
): Promise<{ claim: IdentityClaim | null; error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = archiveIdentityClaimPure(state, ctx.userId, claimId, reason);
  if (!res.ok || !res.data) return { claim: null, error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [res.data.id]);
  return { claim: res.data, error: null };
}

export async function deleteIdentityClaim(
  claimId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = deleteIdentityClaimPure(state, ctx.userId, claimId, reason);
  if (!res.ok) return { error: res.error };
  await commitState(ctx.userId, res.state, ctx.supabase, [], [claimId]);
  return { error: null };
}

export async function explainIdentityClaim(claimId: string): Promise<{
  explanation: string | null;
  claim: IdentityClaim | null;
  error: string | null;
}> {
  const ctx = await getDataContext();
  const state = await hydrateUserState(ctx.userId, ctx.supabase);
  const res = explainIdentityClaimPure(state, ctx.userId, claimId);
  if (!res.ok) return { explanation: null, claim: null, error: "Não encontrada" };
  return { explanation: res.explanation, claim: res.claim, error: null };
}

export async function getIdentityAuditLog(
  limit = 40
): Promise<IdentityAuditEvent[]> {
  const ctx = await getDataContext();
  await hydrateUserState(ctx.userId, ctx.supabase);
  return listIdentityAudits(ctx.userId, limit);
}

/** For Aura Brain Core — confirmed hints only; never executes. */
export async function getIdentityHintsForBrain(): Promise<{
  profile: IdentityProfile;
  subjectUserId: string;
  resolvedForUserIdHash: string;
  decisionSafeKeys: string[];
  communicationTone: string | null;
  preferenceLabels: string[];
  /** Explicit: identity never drives Execution in Architecture v1.0 */
  executionInfluence: "none";
}> {
  const ctx = await getDataContext();
  assertPersonalSubject(ctx.resolved);
  const profile = await getIdentityProfile({ skipCache: false });
  return {
    profile,
    subjectUserId: ctx.resolved.subjectUserId,
    resolvedForUserIdHash: shortUserIdHash(ctx.resolved.subjectUserId),
    decisionSafeKeys: profile.confirmed.map((v) => v.claim.key),
    communicationTone: profile.summary.communicationTone,
    preferenceLabels: profile.summary.preferenceHints,
    executionInfluence: "none",
  };
}
