/**
 * Learning policy — scopes, roles, blocked applications, confirmation hash.
 */

import { hashPayload } from "@/lib/learning/store";
import type {
  LearningProposal,
  LearningProposedChange,
  LearningViewer,
} from "@/lib/learning/types";

export function canViewProposal(
  viewer: LearningViewer,
  proposal: LearningProposal
): boolean {
  if (proposal.softDeleted) return false;
  if (proposal.ownerId === viewer.userId) return true;
  if (
    proposal.scope === "WORKSPACE" &&
    proposal.workspaceId &&
    viewer.workspaceId === proposal.workspaceId &&
    viewer.isWorkspaceMember
  ) {
    return true;
  }
  return false;
}

export function canMutateProposal(
  viewer: LearningViewer,
  proposal: LearningProposal
): boolean {
  if (!canViewProposal(viewer, proposal)) return false;
  if (proposal.ownerId === viewer.userId) return true;
  if (proposal.scope === "WORKSPACE") {
    return viewer.role === "owner" || viewer.role === "admin";
  }
  return false;
}

export function canApplyWorkspaceLearning(viewer: LearningViewer): boolean {
  return (
    viewer.isWorkspaceMember &&
    (viewer.role === "owner" || viewer.role === "admin")
  );
}

export function validateProposedChange(
  change: LearningProposedChange
): { ok: boolean; error: string | null } {
  if (change.elevatesAutonomy) {
    return { ok: false, error: "autonomy_elevation_blocked" };
  }
  if (change.removesConfirmation) {
    return { ok: false, error: "confirmation_removal_blocked" };
  }
  if (change.expandsAllowlist) {
    return { ok: false, error: "allowlist_expand_blocked" };
  }
  if (change.financial) {
    return { ok: false, error: "financial_change_blocked" };
  }
  if (change.sensitiveInference) {
    return { ok: false, error: "sensitive_inference_blocked" };
  }
  const banned = [
    "diagnosis",
    "personality_infer",
    "medical",
    "intellectual_capacity",
    "motivation_infer",
  ];
  if (banned.some((b) => change.kind.includes(b) || change.description.toLowerCase().includes("diagnóst"))) {
    return { ok: false, error: "sensitive_inference_blocked" };
  }
  return { ok: true, error: null };
}

export function validateProposalConfirmation(input: {
  proposal: LearningProposal;
  payload: Record<string, unknown>;
  nowIso: string;
}): { ok: boolean; error: string | null } {
  if (new Date(input.nowIso).getTime() > new Date(input.proposal.validUntil).getTime()) {
    return { ok: false, error: "confirmation_expired" };
  }
  if (
    input.proposal.status !== "PENDING_REVIEW" &&
    input.proposal.status !== "GENERATED" &&
    input.proposal.status !== "CONFIRMED"
  ) {
    return { ok: false, error: "invalid_status" };
  }
  const hash = hashPayload(input.payload);
  if (hash !== input.proposal.payloadHash) {
    return { ok: false, error: "payload_changed" };
  }
  return { ok: true, error: null };
}

export function proposalPayload(proposal: LearningProposal): Record<string, unknown> {
  return {
    id: proposal.id,
    proposalType: proposal.proposalType,
    scope: proposal.scope,
    changeKind: proposal.proposedChange.kind,
    after: proposal.proposedChange.afterSnapshot,
  };
}
