/**
 * Recommendation feedback — accept / ignore / archive / request_review.
 * All feedback is auditable. Never executes.
 */

import {
  newRecommendationId,
  type RecommendationCard,
  type RecommendationFeedback,
  type RecommendationFeedbackKind,
  type RecommendationState,
  type RecommendationStatus,
} from "@/lib/recommendation/types/types";

export function statusAfterRecommendationFeedback(
  kind: RecommendationFeedbackKind
): RecommendationStatus {
  switch (kind) {
    case "accept":
      return "ACCEPTED";
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

export function applyRecommendationFeedbackPure(
  state: RecommendationState,
  input: {
    userId: string;
    workspaceId?: string | null;
    recommendationId: string;
    kind: RecommendationFeedbackKind;
    note?: string | null;
  }
): {
  state: RecommendationState;
  item: RecommendationCard | null;
  feedback: RecommendationFeedback | null;
  error: string | null;
} {
  const item = state.items.find((c) => c.id === input.recommendationId);
  if (!item) {
    return {
      state,
      item: null,
      feedback: null,
      error: "Recomendação não encontrada",
    };
  }
  if (item.userId !== input.userId) {
    return { state, item: null, feedback: null, error: "Sem permissão" };
  }

  const ts = new Date().toISOString();
  const feedback: RecommendationFeedback = {
    id: newRecommendationId("rfb"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? item.workspaceId,
    recommendationId: item.id,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    createdAt: ts,
  };

  const updated: RecommendationCard = {
    ...item,
    status: statusAfterRecommendationFeedback(input.kind),
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
          id: newRecommendationId("rau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? item.workspaceId,
          recommendationId: item.id,
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
