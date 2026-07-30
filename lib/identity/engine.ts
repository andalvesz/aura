/**
 * Pure Identity Engine operations — no DB, no auth.
 */

import {
  applyArchive,
  applyConfirm,
  applyCorrect,
  applyObservation,
  applyReject,
  assertObservationAllowedAsGoal,
  clampConfidence,
  confidenceBand,
  initialConfidenceForCreate,
  statusFromConfidence,
} from "@/lib/identity/confidence";
import {
  detectIdentityConflicts,
  markConflictGroups,
  wouldConflictWith,
} from "@/lib/identity/conflicts";
import {
  assertObservationPrivacy,
  defaultSensitivityFor,
} from "@/lib/identity/privacy";
import { buildIdentityProfile } from "@/lib/identity/profile";
import type {
  CorrectIdentityClaimInput,
  CreateIdentityClaimInput,
  IdentityAuditEvent,
  IdentityClaim,
  IdentityEvidence,
  IdentityProfile,
  ObserveIdentityEvidenceInput,
} from "@/lib/identity/types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function inferValueType(
  value: unknown,
  explicit?: CreateIdentityClaimInput["valueType"]
): IdentityClaim["valueType"] {
  if (explicit) return explicit;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "string_list";
  if (typeof value === "object" && value !== null) return "json";
  return "string";
}

export type IdentityEngineState = {
  claims: IdentityClaim[];
  audits: IdentityAuditEvent[];
};

export function createEmptyIdentityState(): IdentityEngineState {
  return { claims: [], audits: [] };
}

function audit(
  state: IdentityEngineState,
  event: Omit<IdentityAuditEvent, "id" | "createdAt"> & { createdAt?: string }
): IdentityEngineState {
  const entry: IdentityAuditEvent = {
    id: uid("idaud"),
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  };
  return { ...state, audits: [entry, ...state.audits].slice(0, 500) };
}

function snapshot(claim: IdentityClaim): Record<string, unknown> {
  return {
    id: claim.id,
    status: claim.status,
    confidence: claim.confidence,
    value: claim.value,
    label: claim.label,
    contextScope: claim.contextScope,
    key: claim.key,
    category: claim.category,
  };
}

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  state: IdentityEngineState;
  data: T | null;
};

export function createIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  input: CreateIdentityClaimInput
): EngineResult<IdentityClaim> {
  const privacy = assertObservationPrivacy({
    key: input.key,
    category: input.category,
    sourceType: input.sourceType,
    sensitivity: input.sensitivity,
  });
  if (!privacy.ok) {
    return { ok: false, error: privacy.reason, state, data: null };
  }

  const confidence = initialConfidenceForCreate({
    sourceType: input.sourceType,
    confirmNow: input.confirmNow,
    explicitConfidence: input.confidence,
  });

  const goalGate = assertObservationAllowedAsGoal({
    category: input.category,
    sourceType: input.sourceType,
    confidence,
  });
  if (!goalGate.ok) {
    return { ok: false, error: goalGate.reason, state, data: null };
  }

  // Prevent creating HIGH goal from discovery
  if (
    input.category === "goal" &&
    (input.sourceType === "discovery_engine" ||
      input.sourceType === "conversation") &&
    !input.confirmNow
  ) {
    return {
      ok: false,
      error:
        "Objetivos não podem nascer de pesquisa/conversa isolada sem confirmação explícita",
      state,
      data: null,
    };
  }

  const at = new Date().toISOString();
  const status = input.confirmNow
    ? ("CONFIRMED" as const)
    : input.status ?? statusFromConfidence(confidence);

  const evidence: IdentityEvidence[] = [
    {
      id: uid("evid"),
      observedAt: at,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
      summary: input.evidenceSummary ?? `Criação: ${input.label}`,
      strength: confidence,
    },
  ];

  let claim: IdentityClaim = {
    id: uid("claim"),
    userId,
    workspaceId: input.workspaceId ?? null,
    category: input.category,
    key: input.key,
    value: input.value,
    valueType: inferValueType(input.value, input.valueType),
    label: input.label,
    description: input.description ?? "",
    status,
    confidence: clampConfidence(confidence),
    confidenceBand: confidenceBand(confidence),
    weight: input.weight ?? 1,
    contextScope: input.contextScope ?? "global",
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    evidence,
    confidenceHistory: [
      {
        at,
        from: 0,
        to: clampConfidence(confidence),
        reason: input.confirmNow
          ? "Criação confirmada pelo usuário"
          : "Criação inicial",
        actor: input.confirmNow ? "user" : "system",
        previousStatus: "UNKNOWN",
        nextStatus: status,
      },
    ],
    confirmedBy: input.confirmNow ? userId : null,
    confirmedAt: input.confirmNow ? at : null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    validFrom: at,
    validUntil: null,
    lastObservedAt: at,
    sensitivity:
      input.sensitivity ?? defaultSensitivityFor(input.category, input.key),
    conflictGroupId: null,
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    metadata: input.metadata ?? {},
  };

  const conflict = wouldConflictWith(state.claims, claim);
  let claims = [...state.claims, claim];
  const conflicts = detectIdentityConflicts(claims);
  claims = markConflictGroups(claims, conflicts);

  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: claim.workspaceId,
    claimId: claim.id,
    action: "create",
    previousState: null,
    nextState: snapshot(claim),
    sourceType: input.sourceType,
    reason: input.confirmNow
      ? "Claim confirmada na criação"
      : "Claim criada",
    correlationId: null,
  });

  if (conflict) {
    nextState = audit(nextState, {
      userId,
      workspaceId: claim.workspaceId,
      claimId: claim.id,
      action: "conflict_marked",
      previousState: snapshot(conflict),
      nextState: snapshot(claim),
      sourceType: input.sourceType,
      reason: "Conflito detectado com claim existente",
      correlationId: null,
    });
  }

  claim = claims.find((c) => c.id === claim.id) ?? claim;
  return { ok: true, error: null, state: nextState, data: claim };
}

export function observeIdentityEvidencePure(
  state: IdentityEngineState,
  userId: string,
  input: ObserveIdentityEvidenceInput
): EngineResult<IdentityClaim> {
  const privacy = assertObservationPrivacy({
    key: input.key,
    category: input.category,
    sourceType: input.sourceType,
    sensitivity: input.sensitivity,
  });
  if (!privacy.ok) {
    return { ok: false, error: privacy.reason, state, data: null };
  }

  const goalGate = assertObservationAllowedAsGoal({
    category: input.category,
    sourceType: input.sourceType,
    confidence: 35,
  });
  if (!goalGate.ok) {
    return { ok: false, error: goalGate.reason, state, data: null };
  }

  if (
    input.category === "goal" &&
    (input.sourceType === "discovery_engine" ||
      input.sourceType === "conversation")
  ) {
    return {
      ok: false,
      error:
        "Observação isolada de pesquisa/conversa não pode criar ou elevar objetivo",
      state,
      data: null,
    };
  }

  const at = new Date().toISOString();
  const evidence: IdentityEvidence = {
    id: uid("evid"),
    observedAt: at,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    summary: input.evidenceSummary,
    strength: input.evidenceStrength ?? 30,
  };

  const existing = state.claims.find(
    (c) =>
      c.userId === userId &&
      c.category === input.category &&
      c.key === input.key &&
      c.contextScope === (input.contextScope ?? "global") &&
      (c.workspaceId ?? null) === (input.workspaceId ?? null) &&
      c.status !== "REJECTED" &&
      c.status !== "ARCHIVED" &&
      JSON.stringify(c.value) === JSON.stringify(input.value)
  );

  if (existing) {
    const prev = snapshot(existing);
    const updated = applyObservation(existing, evidence);
    let claims = state.claims.map((c) => (c.id === updated.id ? updated : c));
    claims = markConflictGroups(claims, detectIdentityConflicts(claims));
    let nextState: IdentityEngineState = { ...state, claims };
    nextState = audit(nextState, {
      userId,
      workspaceId: updated.workspaceId,
      claimId: updated.id,
      action: "observe",
      previousState: prev,
      nextState: snapshot(updated),
      sourceType: input.sourceType,
      reason: input.evidenceSummary,
      correlationId: null,
    });
    return {
      ok: true,
      error: null,
      state: nextState,
      data: claims.find((c) => c.id === updated.id) ?? updated,
    };
  }

  // Create new OBSERVED claim
  return createIdentityClaimPure(state, userId, {
    category: input.category,
    key: input.key,
    value: input.value,
    valueType: input.valueType,
    label: input.label,
    description: input.description,
    contextScope: input.contextScope,
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    status: "OBSERVED",
    confidence: Math.min(35, initialConfidenceForCreate({ sourceType: input.sourceType })),
    sensitivity: input.sensitivity,
    evidenceSummary: input.evidenceSummary,
    metadata: input.metadata,
  });
}

export function confirmIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  claimId: string,
  reason?: string
): EngineResult<IdentityClaim> {
  const claim = state.claims.find((c) => c.id === claimId && c.userId === userId);
  if (!claim) return { ok: false, error: "Claim não encontrada", state, data: null };
  if (claim.status === "ARCHIVED") {
    return { ok: false, error: "Claim arquivada", state, data: null };
  }
  const prev = snapshot(claim);
  const updated = applyConfirm(claim, userId, reason);
  const claims = state.claims.map((c) => (c.id === claimId ? updated : c));
  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: updated.workspaceId,
    claimId,
    action: "confirm",
    previousState: prev,
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Confirmação explícita",
    correlationId: null,
  });
  return { ok: true, error: null, state: nextState, data: updated };
}

export function rejectIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  claimId: string,
  reason: string
): EngineResult<IdentityClaim> {
  const claim = state.claims.find((c) => c.id === claimId && c.userId === userId);
  if (!claim) return { ok: false, error: "Claim não encontrada", state, data: null };
  const prev = snapshot(claim);
  const updated = applyReject(claim, userId, reason);
  const claims = state.claims.map((c) => (c.id === claimId ? updated : c));
  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: updated.workspaceId,
    claimId,
    action: "reject",
    previousState: prev,
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: nextState, data: updated };
}

export function correctIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  input: CorrectIdentityClaimInput
): EngineResult<IdentityClaim> {
  const claim = state.claims.find(
    (c) => c.id === input.claimId && c.userId === userId
  );
  if (!claim) return { ok: false, error: "Claim não encontrada", state, data: null };
  const prev = snapshot(claim);
  const updated = applyCorrect(
    claim,
    {
      value: input.value !== undefined ? input.value : claim.value,
      label: input.label ?? claim.label,
      description: input.description ?? claim.description,
      contextScope: input.contextScope ?? claim.contextScope,
    },
    input.reason,
    userId
  );
  let claims = state.claims.map((c) => (c.id === updated.id ? updated : c));
  claims = markConflictGroups(claims, detectIdentityConflicts(claims));
  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: updated.workspaceId,
    claimId: updated.id,
    action: "correct",
    previousState: prev,
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason: input.reason,
    correlationId: null,
  });
  return {
    ok: true,
    error: null,
    state: nextState,
    data: claims.find((c) => c.id === updated.id) ?? updated,
  };
}

export function archiveIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  claimId: string,
  reason = "Arquivado pelo usuário"
): EngineResult<IdentityClaim> {
  const claim = state.claims.find((c) => c.id === claimId && c.userId === userId);
  if (!claim) return { ok: false, error: "Claim não encontrada", state, data: null };
  const prev = snapshot(claim);
  const updated = applyArchive(claim, reason);
  const claims = state.claims.map((c) => (c.id === claimId ? updated : c));
  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: updated.workspaceId,
    claimId,
    action: "archive",
    previousState: prev,
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: nextState, data: updated };
}

export function deleteIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  claimId: string,
  reason = "Exclusão solicitada pelo usuário"
): EngineResult<{ id: string }> {
  const claim = state.claims.find((c) => c.id === claimId && c.userId === userId);
  if (!claim) return { ok: false, error: "Claim não encontrada", state, data: null };
  // Soft-delete via ARCHIVED for audit retention when was CONFIRMED/REJECTED history matters
  // Hard remove only OBSERVED/HYPOTHESIS without confirm — still keep audit
  const prev = snapshot(claim);
  const claims = state.claims.filter((c) => c.id !== claimId);
  let nextState: IdentityEngineState = { ...state, claims };
  nextState = audit(nextState, {
    userId,
    workspaceId: claim.workspaceId,
    claimId,
    action: "delete",
    previousState: prev,
    nextState: null,
    sourceType: "user_explicit",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: nextState, data: { id: claimId } };
}

export function getIdentityProfilePure(
  state: IdentityEngineState,
  userId: string,
  opts?: {
    workspaceId?: string | null;
    contextScope?: IdentityProfile["contextScope"];
  }
): IdentityProfile {
  return buildIdentityProfile({
    userId,
    workspaceId: opts?.workspaceId,
    claims: state.claims.filter((c) => c.userId === userId),
    contextScope: opts?.contextScope,
  });
}

export function getIdentityClaimsPure(
  state: IdentityEngineState,
  userId: string,
  opts?: {
    includeRejected?: boolean;
    includeArchived?: boolean;
    workspaceId?: string | null;
  }
): IdentityClaim[] {
  return state.claims.filter((c) => {
    if (c.userId !== userId) return false;
    if (opts?.workspaceId !== undefined) {
      if ((c.workspaceId ?? null) !== (opts.workspaceId ?? null)) return false;
    }
    if (!opts?.includeRejected && c.status === "REJECTED") return false;
    if (!opts?.includeArchived && c.status === "ARCHIVED") return false;
    return true;
  });
}

export function explainIdentityClaimPure(
  state: IdentityEngineState,
  userId: string,
  claimId: string
): { ok: boolean; explanation: string | null; claim: IdentityClaim | null } {
  const claim = state.claims.find((c) => c.id === claimId && c.userId === userId);
  if (!claim) return { ok: false, explanation: null, claim: null };
  const lines = [
    `Afirmação: ${claim.label}`,
    `Status: ${claim.status}`,
    `Confiança: ${claim.confidence} (${claim.confidenceBand})`,
    `Origem principal: ${claim.sourceType}`,
    claim.sourceReference
      ? `Referência: ${claim.sourceReference.entityType}/${claim.sourceReference.entityId}`
      : null,
    `Evidências (${claim.evidence.length}):`,
    ...claim.evidence.map(
      (e, i) =>
        `  ${i + 1}. [${e.sourceType}] ${e.summary} (${e.observedAt})`
    ),
    `Histórico de confiança:`,
    ...claim.confidenceHistory.map(
      (h) =>
        `  ${h.at}: ${h.from}→${h.to} (${h.previousStatus}→${h.nextStatus}) — ${h.reason}`
    ),
  ].filter(Boolean);
  return { ok: true, explanation: lines.join("\n"), claim };
}
