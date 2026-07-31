import {
  canViewPlan,
  newPlanId,
  type PlanComment,
  type PlanState,
} from "@/lib/planner/types/types";

export function addPlanCommentPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    body: string;
    mentions?: string[];
  }
): {
  state: PlanState;
  comment: PlanComment | null;
  error: string | null;
} {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, comment: null, error: "Plano não encontrado" };
  if (
    !canViewPlan(plan, {
      userId: input.userId,
      workspaceId: input.workspaceId,
      isWorkspaceMember: Boolean(input.workspaceId),
    })
  ) {
    return { state, comment: null, error: "Sem permissão" };
  }
  const body = input.body.trim();
  if (!body) return { state, comment: null, error: "Comentário vazio" };
  const ts = new Date().toISOString();
  const comment: PlanComment = {
    id: newPlanId("pcm"),
    planId: plan.id,
    userId: input.userId,
    body,
    mentions: input.mentions ?? [],
    createdAt: ts,
  };
  const notifications = [
    {
      id: newPlanId("pnt"),
      userId: plan.ownerId,
      planId: plan.id,
      kind: "comment" as const,
      title: "Novo comentário",
      body: body.slice(0, 120),
      createdAt: ts,
      read: false,
    },
    ...state.notifications,
  ].slice(0, 200);

  return {
    state: {
      ...state,
      comments: [comment, ...state.comments],
      notifications,
      audit: [
        {
          id: newPlanId("pau"),
          userId: input.userId,
          workspaceId: input.workspaceId ?? plan.workspaceId,
          planId: plan.id,
          action: "comment",
          summary: "Comentário adicionado",
          metadata: { executionInfluence: "none" },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    comment,
    error: null,
  };
}
