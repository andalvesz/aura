import {
  canEditPlan,
  newPlanId,
  type PlanFeedback,
  type PlanFeedbackKind,
  type PlanState,
} from "@/lib/planner/types/types";

export function applyPlanFeedbackPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    stepId?: string | null;
    kind: PlanFeedbackKind;
    note?: string | null;
  }
): {
  state: PlanState;
  feedback: PlanFeedback | null;
  error: string | null;
} {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, feedback: null, error: "Plano não encontrado" };
  if (plan.ownerId !== input.userId && !canEditPlan(plan, input.userId)) {
    // viewers can still leave feedback
    const isCollab = plan.collaborators.some((c) => c.userId === input.userId);
    if (!isCollab && plan.createdBy !== input.userId) {
      return { state, feedback: null, error: "Sem permissão" };
    }
  }
  const ts = new Date().toISOString();
  const feedback: PlanFeedback = {
    id: newPlanId("pfb"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? plan.workspaceId,
    planId: plan.id,
    stepId: input.stepId ?? null,
    kind: input.kind,
    note: input.note ?? null,
    actorUserId: input.userId,
    createdAt: ts,
  };
  return {
    state: {
      ...state,
      feedback: [feedback, ...state.feedback],
      audit: [
        {
          id: newPlanId("pau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? plan.workspaceId,
          planId: plan.id,
          action: `feedback:${input.kind}`,
          summary: `Feedback ${input.kind}`,
          metadata: {
            stepId: input.stepId ?? null,
            executionInfluence: "none",
          },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    feedback,
    error: null,
  };
}
