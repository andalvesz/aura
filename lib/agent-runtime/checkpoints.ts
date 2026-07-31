import type {
  AgentCheckpoint,
  AgentSession,
  AgentStep,
} from "@/lib/agent-runtime/types";
import { nowIso } from "@/lib/agent-runtime/store";

export function buildCheckpoint(
  session: AgentSession,
  steps: AgentStep[]
): AgentCheckpoint {
  const sessionSteps = steps
    .filter((s) => s.sessionId === session.id)
    .sort((a, b) => a.index - b.index);

  const completed = sessionSteps
    .filter((s) => s.status === "VERIFIED" || s.status === "EXECUTED")
    .map((s) => s.id);
  const pending = sessionSteps
    .filter((s) =>
      ["PENDING", "PREPARED", "WAITING_CONFIRMATION", "WAITING_INPUT"].includes(
        s.status
      )
    )
    .map((s) => s.id);

  const waiting = sessionSteps.find(
    (s) =>
      s.status === "WAITING_CONFIRMATION" || s.status === "WAITING_INPUT"
  );

  return {
    stepIndex: sessionSteps.find((s) => s.id === session.currentStepId)?.index ??
      completed.length,
    completedSteps: completed,
    pendingSteps: pending,
    executedActionIds: sessionSteps
      .filter((s) => s.actionId && (s.status === "VERIFIED" || s.status === "EXECUTED"))
      .map((s) => s.actionId!),
    executedIdempotencyKeys: sessionSteps
      .filter((s) => s.status === "VERIFIED" || s.status === "EXECUTED")
      .map((s) => s.idempotencyKey),
    generatedArtifactIds: sessionSteps
      .map((s) => {
        const id = s.executionResult?.notificationId ?? s.executionResult?.draftId;
        return typeof id === "string" ? id : null;
      })
      .filter(Boolean) as string[],
    pendingConfirmationId: waiting?.confirmationToken
      ? waiting.id
      : null,
    contextVersion: session.contextSnapshot?.version ?? "none",
    planVersion:
      session.contextSnapshot?.plans.find((p) => p.id === session.planId)
        ?.rowVersion != null
        ? String(
            session.contextSnapshot.plans.find((p) => p.id === session.planId)!
              .rowVersion
          )
        : null,
    lastResult:
      sessionSteps.filter((s) => s.executionResult).at(-1)?.executionResult ??
      null,
    timestamp: nowIso(),
  };
}

export function alreadyExecuted(
  checkpoint: AgentCheckpoint | null,
  idempotencyKey: string
): boolean {
  if (!checkpoint) return false;
  return checkpoint.executedIdempotencyKeys.includes(idempotencyKey);
}
