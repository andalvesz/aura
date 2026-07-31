/**
 * Collaboration — assign roles. Owner change restricted to owner.
 */

import {
  canEditPlan,
  newPlanId,
  type Plan,
  type PlanRole,
  type PlanState,
} from "@/lib/planner/types/types";

export function assignCollaboratorPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    targetUserId: string;
    role: PlanRole;
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  if (input.role === "owner" && plan.ownerId !== input.userId) {
    return {
      state,
      plan: null,
      error: "Só o owner pode transferir ownership",
    };
  }

  const ts = new Date().toISOString();
  let collaborators = plan.collaborators.filter(
    (c) => c.userId !== input.targetUserId
  );
  collaborators = [
    ...collaborators,
    { userId: input.targetUserId, role: input.role },
  ];
  const updated: Plan = {
    ...plan,
    ownerId: input.role === "owner" ? input.targetUserId : plan.ownerId,
    collaborators,
    updatedAt: ts,
    rowVersion: plan.rowVersion + 1,
    executionInfluence: "none",
  };

  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      notifications: [
        {
          id: newPlanId("pnt"),
          userId: input.targetUserId,
          planId: plan.id,
          kind: "owner_assigned" as const,
          title: "Responsável atribuído",
          body: `Você foi atribuído como ${input.role} em "${plan.title}".`,
          createdAt: ts,
          read: false,
        },
        ...state.notifications,
      ].slice(0, 200),
      audit: [
        {
          id: newPlanId("pau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? plan.workspaceId,
          planId: plan.id,
          action: "assign_collaborator",
          summary: `${input.targetUserId} → ${input.role}`,
          metadata: { executionInfluence: "none" },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    plan: updated,
    error: null,
  };
}
