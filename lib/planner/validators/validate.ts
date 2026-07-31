/**
 * Plan validators — draft validity + approval gate.
 */

import { detectCircularDependencies } from "@/lib/planner/dependencies/detect";
import type { Plan } from "@/lib/planner/types/types";

export type PlanValidationResult = {
  ok: boolean;
  errors: string[];
};

export function validatePlanDraft(plan: Plan): PlanValidationResult {
  const errors: string[] = [];
  if (!plan.title?.trim()) errors.push("missing_title");
  if (!plan.objective?.trim()) errors.push("missing_objective");
  if (!plan.steps?.length) errors.push("missing_steps");
  if (!plan.successCriteria?.length) errors.push("missing_successCriteria");
  if (!plan.limitations?.length) errors.push("missing_limitations");
  if (!plan.risks?.length) errors.push("missing_risks");
  if (!plan.ownerId) errors.push("missing_ownership");
  if (!plan.sourceKind) errors.push("missing_source");
  if (plan.executionInfluence !== "none") {
    errors.push("executionInfluence_must_be_none");
  }
  if (plan.context === "workspace" && !plan.workspaceId) {
    errors.push("invalid_workspace");
  }
  const cycles = detectCircularDependencies(plan.steps);
  if (cycles.length) errors.push("circular_dependencies");
  return { ok: errors.length === 0, errors };
}

/** Stricter gate for approval — human still must click approve. */
export function validatePlanForApproval(plan: Plan): PlanValidationResult {
  const base = validatePlanDraft(plan);
  const errors = [...base.errors];
  if (plan.dependencyIssues.some((i) => i.kind === "circular")) {
    if (!errors.includes("circular_dependencies")) {
      errors.push("circular_dependencies");
    }
  }
  const unresolvedCritical = plan.dependencyIssues.filter(
    (i) => i.requiresHumanReview && i.kind === "circular"
  );
  if (unresolvedCritical.length) {
    errors.push("unresolved_circular_dependencies");
  }
  if (!plan.steps.every((s) => s.requiresConfirmation || s.stepType === "REVIEW")) {
    // soft: still allow but flag if NO confirmation steps
    if (!plan.steps.some((s) => s.requiresConfirmation)) {
      errors.push("no_confirmation_steps");
    }
  }
  return { ok: errors.length === 0, errors };
}
