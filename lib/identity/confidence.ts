/**
 * Confidence lifecycle for Identity claims — ADR-005.
 */

import type {
  ConfidenceBand,
  ConfidenceHistoryEntry,
  IdentityClaim,
  IdentityClaimStatus,
  IdentityEvidence,
  IdentitySourceType,
} from "@/lib/identity/types";

export function clampConfidence(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function confidenceBand(score: number): ConfidenceBand {
  const c = clampConfidence(score);
  if (c >= 70) return "HIGH";
  if (c >= 40) return "MEDIUM";
  return "LOW";
}

/** Source trust baseline (0–100) before corroboration. */
export function sourceTrustBaseline(source: IdentitySourceType): number {
  switch (source) {
    case "user_explicit":
    case "manual_entry":
      return 90;
    case "bootstrap_profile":
    case "bootstrap_settings":
      return 85;
    case "memory_engine":
      return 50;
    case "imported_data":
      return 55;
    case "mission_engine":
    case "execution_result":
      return 45;
    case "calendar":
    case "finance":
    case "health":
    case "business":
      return 40;
    case "system_observation":
    case "planner":
      return 30;
    case "conversation":
    case "discovery_engine":
      return 25;
    default:
      return 20;
  }
}

/**
 * Isolated research / discovery / conversation must never create HIGH confidence.
 */
export function isLowTrustIsolatedSource(source: IdentitySourceType): boolean {
  return (
    source === "discovery_engine" ||
    source === "conversation" ||
    source === "system_observation"
  );
}

export function initialConfidenceForCreate(input: {
  sourceType: IdentitySourceType;
  confirmNow?: boolean;
  explicitConfidence?: number;
}): number {
  if (input.confirmNow) return clampConfidence(input.explicitConfidence ?? 95);
  if (typeof input.explicitConfidence === "number") {
    let c = clampConfidence(input.explicitConfidence);
    if (isLowTrustIsolatedSource(input.sourceType)) {
      c = Math.min(c, 39);
    }
    return c;
  }
  let c = sourceTrustBaseline(input.sourceType);
  if (isLowTrustIsolatedSource(input.sourceType)) {
    c = Math.min(c, 35);
  }
  return clampConfidence(c);
}

export function statusFromConfidence(
  confidence: number,
  preferred?: IdentityClaimStatus
): IdentityClaimStatus {
  if (
    preferred === "CONFIRMED" ||
    preferred === "REJECTED" ||
    preferred === "ARCHIVED" ||
    preferred === "LEARNED" ||
    preferred === "OUTDATED"
  ) {
    return preferred;
  }
  const c = clampConfidence(confidence);
  if (c >= 70) return preferred === "LIKELY" ? "LIKELY" : "LIKELY";
  if (c >= 40) return "HYPOTHESIS";
  if (c > 0) return "OBSERVED";
  return "UNKNOWN";
}

export function pushConfidenceHistory(
  claim: IdentityClaim,
  to: number,
  reason: string,
  actor: "user" | "system",
  nextStatus: IdentityClaimStatus,
  at = new Date().toISOString()
): IdentityClaim {
  const entry: ConfidenceHistoryEntry = {
    at,
    from: claim.confidence,
    to: clampConfidence(to),
    reason,
    actor,
    previousStatus: claim.status,
    nextStatus,
  };
  return {
    ...claim,
    confidence: clampConfidence(to),
    confidenceBand: confidenceBand(to),
    status: nextStatus,
    confidenceHistory: [...claim.confidenceHistory, entry],
    updatedAt: at,
  };
}

/**
 * Merge a new observation: append evidence, never drop prior evidence.
 * Isolated sources cannot jump to HIGH; corroboration raises gradually.
 */
export function applyObservation(
  claim: IdentityClaim,
  evidence: IdentityEvidence,
  opts?: { forceStatus?: IdentityClaimStatus }
): IdentityClaim {
  const at = evidence.observedAt;
  const evidenceList = [...claim.evidence, evidence];
  const corroborationBonus = Math.min(25, (evidenceList.length - 1) * 8);
  const sourceBase = sourceTrustBaseline(evidence.sourceType);
  let next = Math.max(
    claim.confidence,
    Math.min(69, sourceBase + corroborationBonus)
  );

  // Confirmed stays high unless observation contradicts (handled elsewhere)
  if (claim.status === "CONFIRMED" || claim.status === "LEARNED") {
    next = Math.max(claim.confidence, Math.min(claim.confidence, 100));
  }

  if (isLowTrustIsolatedSource(evidence.sourceType) && claim.status !== "CONFIRMED") {
    next = Math.min(next, 39);
  }

  // Multiple coherent evidences from non-isolated sources can reach LIKELY
  const nonIsolated = evidenceList.filter(
    (e) => !isLowTrustIsolatedSource(e.sourceType)
  );
  if (nonIsolated.length >= 3 && claim.status !== "CONFIRMED") {
    next = Math.max(next, Math.min(72, 40 + nonIsolated.length * 8));
  }

  let nextStatus: IdentityClaimStatus =
    opts?.forceStatus ??
    (claim.status === "CONFIRMED" || claim.status === "LEARNED"
      ? claim.status
      : statusFromConfidence(next));

  if (claim.status === "REJECTED" || claim.status === "ARCHIVED") {
    // Observation on rejected claim does not revive — caller should create new claim
    return claim;
  }

  const updated = pushConfidenceHistory(
    {
      ...claim,
      evidence: evidenceList,
      lastObservedAt: at,
      sourceType: evidence.sourceType,
      sourceReference: evidence.sourceReference ?? claim.sourceReference,
    },
    next,
    `observation:${evidence.summary}`,
    "system",
    nextStatus,
    at
  );
  return updated;
}

export function applyConfirm(
  claim: IdentityClaim,
  userId: string,
  reason = "Confirmação explícita do usuário"
): IdentityClaim {
  const at = new Date().toISOString();
  const next = pushConfidenceHistory(claim, 95, reason, "user", "CONFIRMED", at);
  return {
    ...next,
    confirmedBy: userId,
    confirmedAt: at,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };
}

export function applyReject(
  claim: IdentityClaim,
  userId: string,
  reason: string
): IdentityClaim {
  const at = new Date().toISOString();
  const next = pushConfidenceHistory(claim, 0, reason, "user", "REJECTED", at);
  return {
    ...next,
    rejectedBy: userId,
    rejectedAt: at,
    rejectionReason: reason,
    confirmedBy: null,
    confirmedAt: null,
  };
}

export function applyCorrect(
  claim: IdentityClaim,
  patch: Partial<
    Pick<IdentityClaim, "value" | "label" | "description" | "contextScope">
  >,
  reason: string,
  userId: string
): IdentityClaim {
  const at = new Date().toISOString();
  let next: IdentityClaim = {
    ...claim,
    ...patch,
    updatedAt: at,
  };
  // Correction by user elevates to CONFIRMED
  next = pushConfidenceHistory(next, 95, reason, "user", "CONFIRMED", at);
  return {
    ...next,
    confirmedBy: userId,
    confirmedAt: at,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
  };
}

export function applyArchive(claim: IdentityClaim, reason: string): IdentityClaim {
  const at = new Date().toISOString();
  const next = pushConfidenceHistory(
    claim,
    claim.confidence,
    reason,
    "user",
    "ARCHIVED",
    at
  );
  return { ...next, archivedAt: at };
}

/** Research/discovery alone must not become a goal claim at HIGH confidence. */
export function assertObservationAllowedAsGoal(input: {
  category: string;
  sourceType: IdentitySourceType;
  confidence: number;
}): { ok: boolean; reason: string | null } {
  if (input.category !== "goal") return { ok: true, reason: null };
  if (
    isLowTrustIsolatedSource(input.sourceType) ||
    input.sourceType === "discovery_engine"
  ) {
    if (input.confidence >= 40) {
      return {
        ok: false,
        reason:
          "Pesquisa/observação isolada não pode criar objetivo com confiança média/alta",
      };
    }
  }
  return { ok: true, reason: null };
}
