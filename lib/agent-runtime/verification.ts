import type {
  AgentStep,
  AgentVerificationPolicy,
  AgentVerificationResult,
} from "@/lib/agent-runtime/types";

export function verifyStepResult(params: {
  step: AgentStep;
  output: Record<string, unknown>;
  ok: boolean;
  error: string | null;
  policy: AgentVerificationPolicy;
}): AgentVerificationResult {
  const { step, output, ok, error, policy } = params;

  if (!ok) {
    return {
      ok: false,
      expectedChange: `Executar ${step.actionId}`,
      observedChange: error ?? "execution_failed",
      partial: false,
      inconsistent: true,
      evidence: [],
      error: error ?? "execution_failed",
    };
  }

  // Never assume success only because no throw — require observable output
  const hasSignal =
    Object.keys(output).length > 0 &&
    (output.draft === true ||
      output.prepared === true ||
      typeof output.notificationId === "string" ||
      output.undone === true ||
      output.skipped === true ||
      typeof output.title === "string");

  if (!hasSignal) {
    return {
      ok: false,
      expectedChange: `Artefato de ${step.actionId}`,
      observedChange: "empty_output",
      partial: true,
      inconsistent: true,
      evidence: [],
      error: "verification_empty_output",
    };
  }

  if (policy === "strict") {
    if (step.actionId === "mark_plan_step_complete") {
      if (!output.planId && !step.input.planId) {
        return {
          ok: false,
          expectedChange: "planId no resultado",
          observedChange: "missing_planId",
          partial: true,
          inconsistent: true,
          evidence: [JSON.stringify(output).slice(0, 120)],
          error: "strict_plan_id_missing",
        };
      }
    }
  }

  return {
    ok: true,
    expectedChange: `Ação ${step.actionId} aplicada`,
    observedChange: Object.keys(output).join(","),
    partial: output.skipped === true,
    inconsistent: false,
    evidence: [
      typeof output.notificationId === "string"
        ? `notification:${output.notificationId}`
        : `keys:${Object.keys(output).join("|")}`,
    ],
    error: null,
  };
}
