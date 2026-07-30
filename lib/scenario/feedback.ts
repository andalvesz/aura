/**
 * Scenario feedback — save / archive / compare / discard.
 */

import {
  newScenarioId,
  type ScenarioCard,
  type ScenarioFeedback,
  type ScenarioFeedbackKind,
  type ScenarioState,
  type ScenarioStatus,
} from "@/lib/scenario/types/types";

export function statusAfterScenarioFeedback(
  kind: ScenarioFeedbackKind
): ScenarioStatus {
  switch (kind) {
    case "save":
      return "SAVED";
    case "archive":
      return "ARCHIVED";
    case "compare":
      return "COMPARED";
    case "discard":
      return "DISCARDED";
    default:
      return "DRAFT";
  }
}

export function applyScenarioFeedbackPure(
  state: ScenarioState,
  input: {
    userId: string;
    workspaceId?: string | null;
    scenarioId: string;
    kind: ScenarioFeedbackKind;
    note?: string | null;
  }
): {
  state: ScenarioState;
  card: ScenarioCard | null;
  feedback: ScenarioFeedback | null;
  error: string | null;
} {
  const card = state.scenarios.find((c) => c.id === input.scenarioId);
  if (!card) {
    return { state, card: null, feedback: null, error: "Cenário não encontrado" };
  }
  if (card.userId !== input.userId) {
    return { state, card: null, feedback: null, error: "Sem permissão" };
  }

  const ts = new Date().toISOString();
  const feedback: ScenarioFeedback = {
    id: newScenarioId("sfb"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? card.workspaceId,
    scenarioId: card.id,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    createdAt: ts,
  };

  const updated: ScenarioCard = {
    ...card,
    status: statusAfterScenarioFeedback(input.kind),
    updatedAt: ts,
    executionInfluence: "none",
  };

  return {
    state: {
      ...state,
      scenarios: state.scenarios.map((c) => (c.id === card.id ? updated : c)),
      feedback: [feedback, ...state.feedback],
      audit: [
        {
          id: newScenarioId("sau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? card.workspaceId,
          scenarioId: card.id,
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
