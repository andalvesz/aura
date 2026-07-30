/**
 * Priority feedback — confirm / ignore / archive / request_review.
 * All feedback is auditable. Never executes.
 */

import {
  newPriorityId,
  type PriorityFeedback,
  type PriorityFeedbackKind,
  type PriorityItem,
  type PriorityState,
  type PriorityStatus,
} from "@/lib/prioritization/types/types";

export function statusAfterPriorityFeedback(
  kind: PriorityFeedbackKind
): PriorityStatus {
  switch (kind) {
    case "confirm":
      return "CONFIRMED";
    case "ignore":
      return "IGNORED";
    case "archive":
      return "ARCHIVED";
    case "request_review":
      return "NEEDS_REVIEW";
    default:
      return "SUGGESTED";
  }
}

export function applyPriorityFeedbackPure(
  state: PriorityState,
  input: {
    userId: string;
    workspaceId?: string | null;
    priorityId: string;
    kind: PriorityFeedbackKind;
    note?: string | null;
  }
): {
  state: PriorityState;
  item: PriorityItem | null;
  feedback: PriorityFeedback | null;
  error: string | null;
} {
  const item = state.items.find((c) => c.id === input.priorityId);
  if (!item) {
    return {
      state,
      item: null,
      feedback: null,
      error: "Prioridade não encontrada",
    };
  }
  if (item.userId !== input.userId) {
    return { state, item: null, feedback: null, error: "Sem permissão" };
  }

  const ts = new Date().toISOString();
  const feedback: PriorityFeedback = {
    id: newPriorityId("pfb"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? item.workspaceId,
    priorityId: item.id,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    createdAt: ts,
  };

  const updated: PriorityItem = {
    ...item,
    status: statusAfterPriorityFeedback(input.kind),
    updatedAt: ts,
    lastReviewedAt: ts,
    executionInfluence: "none",
  };

  return {
    state: {
      ...state,
      items: state.items.map((c) => (c.id === item.id ? updated : c)),
      feedback: [feedback, ...state.feedback],
      audit: [
        {
          id: newPriorityId("pau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? item.workspaceId,
          priorityId: item.id,
          action: `feedback:${input.kind}`,
          summary: `${input.kind} → ${updated.status}`,
          metadata: { note: input.note ?? null, executionInfluence: "none" },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    item: updated,
    feedback,
    error: null,
  };
}
