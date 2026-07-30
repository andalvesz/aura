/**
 * Decision feedback — accept / ignore / archive / request_review.
 * All feedback is auditable. Never executes.
 */

import {
  newDecisionId,
  type DecisionCard,
  type DecisionFeedback,
  type DecisionFeedbackKind,
  type DecisionState,
  type DecisionStatus,
} from "@/lib/decision-support/types/types";

export function statusAfterDecisionFeedback(
  kind: DecisionFeedbackKind
): DecisionStatus {
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

export function applyDecisionFeedbackPure(
  state: DecisionState,
  input: {
    userId: string;
    workspaceId?: string | null;
    decisionId: string;
    kind: DecisionFeedbackKind;
    note?: string | null;
  }
): {
  state: DecisionState;
  card: DecisionCard | null;
  feedback: DecisionFeedback | null;
  error: string | null;
} {
  const card = state.cards.find((c) => c.id === input.decisionId);
  if (!card) {
    return { state, card: null, feedback: null, error: "Decisão não encontrada" };
  }
  if (card.userId !== input.userId) {
    return { state, card: null, feedback: null, error: "Sem permissão" };
  }

  const ts = new Date().toISOString();
  const feedback: DecisionFeedback = {
    id: newDecisionId("dfb"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? card.workspaceId,
    decisionId: card.id,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    createdAt: ts,
  };

  const updated: DecisionCard = {
    ...card,
    status: statusAfterDecisionFeedback(input.kind),
    updatedAt: ts,
    lastReviewedAt: ts,
    executionInfluence: "none",
  };

  return {
    state: {
      ...state,
      cards: state.cards.map((c) => (c.id === card.id ? updated : c)),
      feedback: [feedback, ...state.feedback],
      audit: [
        {
          id: newDecisionId("dau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? card.workspaceId,
          decisionId: card.id,
          action: `feedback:${input.kind}`,
          summary: `${input.kind} → ${updated.status}`,
          metadata: { note: input.note ?? null, executionInfluence: "none" },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    card: updated,
    feedback,
    error: null,
  };
}
