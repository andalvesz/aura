/**
 * Approval flow — explicit human actions only. Never executes.
 */

import { validatePlanForApproval } from "@/lib/planner/validators/validate";
import {
  canEditPlan,
  newPlanId,
  type Plan,
  type PlanState,
  type PlanStatus,
  type PlanStepStatus,
} from "@/lib/planner/types/types";

function bump(plan: Plan, ts: string): Plan {
  return {
    ...plan,
    updatedAt: ts,
    rowVersion: plan.rowVersion + 1,
    executionInfluence: "none",
  };
}

function audit(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    action: string;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  ts: string
): PlanState["audit"] {
  return [
    {
      id: newPlanId("pau"),
      userId: input.userId,
      workspaceId: input.workspaceId ?? null,
      planId: input.planId,
      action: input.action,
      summary: input.summary,
      metadata: {
        executionInfluence: "none",
        ...(input.metadata ?? {}),
      },
      createdAt: ts,
    },
    ...state.audit,
  ].slice(0, 500);
}

export function submitPlanForReviewPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  if (plan.status !== "DRAFT")
    return { state, plan: null, error: "Só rascunhos podem ir para revisão" };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "PENDING_REVIEW" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "submit_review",
          summary: "Enviado para aprovação",
        },
        ts
      ),
      notifications: [
        {
          id: newPlanId("pnt"),
          userId: plan.ownerId,
          planId: plan.id,
          kind: "pending_approval" as const,
          title: "Plano aguardando aprovação",
          body: `"${plan.title}" está PENDING_REVIEW.`,
          createdAt: ts,
          read: false,
        },
        ...state.notifications,
      ].slice(0, 200),
    },
    plan: updated,
    error: null,
  };
}

export function approvePlanPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (plan.ownerId !== input.userId && !canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão para aprovar" };
  if (!["DRAFT", "PENDING_REVIEW"].includes(plan.status))
    return { state, plan: null, error: "Status inválido para aprovação" };

  const gate = validatePlanForApproval(plan);
  if (!gate.ok) {
    return {
      state,
      plan: null,
      error: `Não aprovável: ${gate.errors.join(", ")}`,
    };
  }

  const ts = new Date().toISOString();
  const updated = bump(
    {
      ...plan,
      status: "APPROVED",
      steps: plan.steps.map((s) =>
        s.status === "DRAFT" ? { ...s, status: "APPROVED" as PlanStepStatus } : s
      ),
    },
    ts
  );
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "approve",
          summary: "Plano aprovado — sem execução",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function rejectPlanPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    note?: string;
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "DRAFT" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "reject",
          summary: input.note ?? "Rejeitado — voltou para DRAFT",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function startPlanPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  if (plan.status !== "APPROVED" && plan.status !== "PAUSED")
    return {
      state,
      plan: null,
      error: "Só planos APPROVED ou PAUSED podem iniciar",
    };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "IN_PROGRESS" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "start",
          summary: "Status → IN_PROGRESS (sem execução externa)",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function pausePlanPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  if (plan.status !== "IN_PROGRESS")
    return { state, plan: null, error: "Só IN_PROGRESS pode pausar" };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "PAUSED" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "pause",
          summary: "Pausado",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function completeStepPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    stepId: string;
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  const step = plan.steps.find((s) => s.id === input.stepId);
  if (!step) return { state, plan: null, error: "Etapa não encontrada" };
  if (["COMPLETED", "SKIPPED", "CANCELLED"].includes(step.status))
    return { state, plan: null, error: "Etapa já finalizada" };

  const ts = new Date().toISOString();
  const steps = plan.steps.map((s) =>
    s.id === step.id ? { ...s, status: "COMPLETED" as PlanStepStatus } : s
  );
  const updated = bump({ ...plan, steps }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "complete_step",
          summary: `Etapa concluída: ${step.title}`,
          metadata: { stepId: step.id },
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function completePlanPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    force?: boolean;
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  const allDone = plan.steps.every((s) =>
    ["COMPLETED", "SKIPPED", "CANCELLED"].includes(s.status)
  );
  if (!allDone && !input.force) {
    return {
      state,
      plan: null,
      error: "Critérios/etapas incompletos — use force com confirmação",
    };
  }
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "COMPLETED" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "complete_plan",
          summary: input.force
            ? "Concluído com confirmação explícita"
            : "Concluído",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function archivePlanPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (plan.ownerId !== input.userId)
    return { state, plan: null, error: "Só o owner arquiva" };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: "ARCHIVED" }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "archive",
          summary: "Arquivado",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function reorderStepsPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    stepIdsInOrder: string[];
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  if (input.stepIdsInOrder.length !== plan.steps.length)
    return { state, plan: null, error: "Ordem incompleta" };
  const byId = new Map(plan.steps.map((s) => [s.id, s]));
  const steps = input.stepIdsInOrder.map((id, order) => {
    const s = byId.get(id);
    if (!s) throw new Error("step missing");
    return { ...s, order };
  });
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, steps }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "reorder_steps",
          summary: "Etapas reordenadas (sem execução)",
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function updatePlanStatusPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    planId: string;
    status: PlanStatus;
  }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  const ts = new Date().toISOString();
  const updated = bump({ ...plan, status: input.status }, ts);
  return {
    state: {
      ...state,
      plans: state.plans.map((p) => (p.id === plan.id ? updated : p)),
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: plan.id,
          action: "status_change",
          summary: `Status → ${input.status}`,
        },
        ts
      ),
    },
    plan: updated,
    error: null,
  };
}

export function duplicatePlanPure(
  state: PlanState,
  input: { userId: string; workspaceId?: string | null; planId: string }
): { state: PlanState; plan: Plan | null; error: string | null } {
  const plan = state.plans.find((p) => p.id === input.planId);
  if (!plan) return { state, plan: null, error: "Plano não encontrado" };
  if (!canEditPlan(plan, input.userId))
    return { state, plan: null, error: "Sem permissão" };
  const ts = new Date().toISOString();
  const newId = newPlanId("plan");
  const stepMap = new Map(
    plan.steps.map((s) => [s.id, newPlanId("pst")] as const)
  );
  const copy: Plan = {
    ...plan,
    id: newId,
    title: `${plan.title} (cópia)`,
    status: "DRAFT",
    steps: plan.steps.map((s) => ({
      ...s,
      id: stepMap.get(s.id)!,
      planId: newId,
      status: "DRAFT",
      dependsOn: s.dependsOn
        .map((d) => stepMap.get(d) ?? d)
        .filter((d) => [...stepMap.values()].includes(d)),
    })),
    milestones: plan.milestones.map((m) => ({
      ...m,
      id: newPlanId("pml"),
      planId: newId,
      relatedSteps: m.relatedSteps
        .map((d) => stepMap.get(d) ?? d)
        .filter((d) => [...stepMap.values()].includes(d)),
      status: "SUGGESTED",
    })),
    resources: plan.resources.map((r) => ({
      ...r,
      id: newPlanId("prs"),
      planId: newId,
    })),
    risks: plan.risks.map((r) => ({
      ...r,
      id: newPlanId("prk"),
      planId: newId,
    })),
    dependencyIssues: [],
    createdAt: ts,
    updatedAt: ts,
    rowVersion: 1,
    executionInfluence: "none",
  };
  return {
    state: {
      ...state,
      plans: [copy, ...state.plans],
      audit: audit(
        state,
        {
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: newId,
          action: "duplicate",
          summary: `Duplicado de ${plan.id}`,
        },
        ts
      ),
    },
    plan: copy,
    error: null,
  };
}
