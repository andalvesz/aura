/**
 * Feedback + suppression helpers.
 */

import type {
  CognitiveArtifact,
  CognitiveFeedback,
  CognitiveSuppression,
  FeedbackKind,
} from "@/lib/cognitive/types";

export function createFeedback(input: {
  userId: string;
  workspaceId?: string | null;
  artifactId: string;
  kind: FeedbackKind;
  note?: string | null;
  correctionPayload?: Record<string, unknown> | null;
}): CognitiveFeedback {
  return {
    id: `cfb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    artifactId: input.artifactId,
    kind: input.kind,
    note: input.note ?? null,
    correctionPayload: input.correctionPayload ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function statusAfterFeedback(
  kind: FeedbackKind,
  current: CognitiveArtifact["status"]
): CognitiveArtifact["status"] {
  switch (kind) {
    case "confirm":
    case "accurate":
    case "useful":
      return "CONFIRMED";
    case "reject":
    case "inaccurate":
    case "irrelevant":
    case "sensitive":
      return "REJECTED";
    case "correct":
      return "CORRECTED";
    case "outdated":
      return "OUTDATED";
    case "needs_more_evidence":
    case "misunderstood":
      return "DISPUTED";
    case "suppress_similar":
      return "REJECTED";
    default:
      return current;
  }
}

export function createSuppression(input: {
  userId: string;
  workspaceId?: string | null;
  artifact: CognitiveArtifact;
  reason: string;
  expiresAt?: string | null;
}): CognitiveSuppression {
  return {
    id: `csp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    artifactType: input.artifact.artifactType,
    category: input.artifact.category,
    semanticKey: input.artifact.suppressionKey ?? input.artifact.fingerprint,
    context: input.artifact.timeRange.label ?? null,
    sourceSetHash: input.artifact.evidenceSetHash,
    reason: input.reason,
    expiresAt: input.expiresAt ?? null,
    createdAt: new Date().toISOString(),
    brokenAt: null,
    breakReason: null,
  };
}

export function isSuppressionActive(
  s: CognitiveSuppression,
  now = Date.now()
): boolean {
  if (s.brokenAt) return false;
  if (s.expiresAt && new Date(s.expiresAt).getTime() < now) return false;
  return true;
}

export function canBreakSuppression(input: {
  suppression: CognitiveSuppression;
  explicitUserRequest?: boolean;
  newIndependentEvidence?: boolean;
  contextChanged?: boolean;
}): { allowed: boolean; reason: string } {
  if (input.explicitUserRequest) {
    return { allowed: true, reason: "explicit_user_request" };
  }
  if (
    input.suppression.expiresAt &&
    new Date(input.suppression.expiresAt).getTime() < Date.now()
  ) {
    return { allowed: true, reason: "expired" };
  }
  if (input.newIndependentEvidence) {
    return { allowed: true, reason: "new_independent_evidence" };
  }
  if (input.contextChanged) {
    return { allowed: true, reason: "context_changed" };
  }
  return { allowed: false, reason: "still_active" };
}
