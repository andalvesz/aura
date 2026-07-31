/**
 * Plan generation & list/get/home — never executes.
 */

import { analyzePlanDependencies } from "@/lib/planner/dependencies/detect";
import { buildPlanContext } from "@/lib/planner/context/context";
import { runPlannerRegistry } from "@/lib/planner/registry/registry";
import {
  suggestPlanWindow,
  suggestStepDates,
} from "@/lib/planner/scheduling/dates";
import { baseManualDraft } from "@/lib/planner/templates/templates";
import { validatePlanDraft } from "@/lib/planner/validators/validate";
import {
  canViewPlan,
  newPlanId,
  type Plan,
  type PlanContext,
  type PlanDraftProposal,
  type PlanHomeWidget,
  type PlanSourceKind,
  type PlanSourceSlice,
  type PlanState,
  type PlanStatus,
} from "@/lib/planner/types/types";

function nowIso(): string {
  return new Date().toISOString();
}

function materializeDraft(
  draft: PlanDraftProposal,
  input: {
    userId: string;
    workspaceId?: string | null;
    context: PlanContext;
  }
): Plan {
  const ts = nowIso();
  const planId = newPlanId("plan");
  const window = suggestPlanWindow({
    effort: draft.estimatedEffort,
    asOf: new Date(),
  });
  const start = draft.startDateSuggested ?? window.start;
  const target = draft.targetDateSuggested ?? window.target;

  // Assign real step ids and resolve __seq_N dependsOn
  const stepIds = draft.steps.map(() => newPlanId("pst"));
  const steps = draft.steps.map((s, i) => {
    const dates = suggestStepDates(i, start, s.estimatedEffort);
    const dependsOn = s.dependsOn
      .map((d) => {
        const m = /^__seq_(\d+)$/.exec(d);
        if (m) return stepIds[Number(m[1])] ?? d;
        return d;
      })
      .filter(Boolean);
    return {
      ...s,
      id: stepIds[i],
      planId,
      dependsOn,
      suggestedStart: s.suggestedStart ?? dates.start,
      suggestedDeadline: s.suggestedDeadline ?? dates.deadline,
      ownerId: s.ownerId ?? input.userId,
      status: "DRAFT" as const,
      requiresConfirmation: true,
    };
  });

  const milestones = draft.milestones.map((m, i) => ({
    ...m,
    id: newPlanId("pml"),
    planId,
    relatedSteps: m.relatedSteps
      .map((d) => {
        const seq = /^__seq_(\d+)$/.exec(d);
        if (seq) return stepIds[Number(seq[1])] ?? d;
        return d;
      })
      .filter((id) => steps.some((s) => s.id === id)),
  }));

  const resources = draft.resources.map((r) => ({
    ...r,
    id: newPlanId("prs"),
    planId,
  }));

  const risks = draft.risks.map((r) => ({
    ...r,
    id: newPlanId("prk"),
    planId,
  }));

  const missingResources = resources
    .filter((r) => r.availability === "ABSENT" || r.availability === "UNKNOWN")
    .map((r) => r.title);

  const dependencyIssues = analyzePlanDependencies({
    planId,
    steps,
    hasOwner: true,
    resourceTitles: resources.map((r) => r.title),
    missingResourceTitles: missingResources.slice(0, 3),
    gaps: input.context.dataCompleteness.gaps,
  });

  const plan: Plan = {
    id: planId,
    title: draft.title,
    summary: draft.summary,
    objective: draft.objective,
    status: "DRAFT",
    context: input.workspaceId ? "workspace" : "personal",
    workspaceId: input.workspaceId ?? null,
    projectId: draft.projectId ?? null,
    missionId: draft.missionId ?? null,
    recommendationId: draft.recommendationId ?? null,
    decisionId: draft.decisionId ?? null,
    scenarioId: draft.scenarioId ?? null,
    priorityId: draft.priorityId ?? null,
    ownerId: input.userId,
    createdBy: input.userId,
    confidence: draft.confidence,
    assumptions: draft.assumptions,
    limitations: draft.limitations,
    successCriteria: draft.successCriteria,
    startDateSuggested: start,
    targetDateSuggested: target,
    estimatedEffort: draft.estimatedEffort,
    riskLevel: draft.riskLevel,
    sourceKind: draft.sourceKind,
    sourceId: draft.sourceId,
    steps,
    milestones,
    resources,
    risks,
    dependencyIssues,
    collaborators: [{ userId: input.userId, role: "owner" }],
    alternatives: draft.alternatives,
    pipelineSteps: draft.pipelineSteps,
    visibilityScope: "PRIVATE",
    executionInfluence: "none",
    rowVersion: 1,
    softDeleted: false,
    createdAt: ts,
    updatedAt: ts,
  };

  return plan;
}

export function seedDraftFromSource(input: {
  sourceKind: PlanSourceKind;
  sourceId?: string | null;
  title?: string;
  objective?: string;
  sources?: Partial<PlanSourceSlice>;
}): PlanDraftProposal {
  const sources = input.sources ?? {};
  if (input.sourceKind === "recommendation") {
    const rec = (sources.recommendations ?? []).find(
      (r) => r.id === input.sourceId
    ) ?? (sources.recommendations ?? [])[0];
    if (rec) {
      return {
        title: `Plano: ${rec.title}`,
        summary: rec.summary,
        objective: rec.reasoning?.whyAppeared || rec.summary,
        assumptions: [
          "Baseado em recomendação aceita — ainda requer revisão humana.",
        ],
        limitations: [
          ...(rec.limitations ?? []),
          "Não executa a recomendação automaticamente.",
        ],
        successCriteria: ["Plano aprovado e etapas revisadas"],
        estimatedEffort: "MEDIUM",
        riskLevel: "MEDIUM",
        confidence: rec.confidence,
        steps: [],
        milestones: [],
        resources: [],
        risks: [],
        alternatives: (rec.alternatives ?? []).map(
          (a) => `${a.title}: ${a.summary}`
        ),
        pipelineSteps: ["from_recommendation"],
        projectId: rec.relatedProject ?? null,
        recommendationId: rec.id,
        decisionId: rec.relatedDecision ?? null,
        scenarioId: rec.relatedScenario ?? null,
        priorityId: rec.relatedPriority ?? null,
        sourceKind: "recommendation",
        sourceId: rec.id,
      };
    }
  }
  if (input.sourceKind === "decision") {
    const d =
      (sources.decisions ?? []).find((x) => x.id === input.sourceId) ??
      (sources.decisions ?? [])[0];
    if (d) {
      return {
        ...baseManualDraft({ title: `Plano: ${d.title}`, objective: d.summary }),
        sourceKind: "decision",
        sourceId: d.id,
        decisionId: d.id,
        confidence: d.confidence,
        pipelineSteps: ["from_decision"],
      };
    }
  }
  if (input.sourceKind === "scenario") {
    const s =
      (sources.scenarios ?? []).find((x) => x.id === input.sourceId) ??
      (sources.scenarios ?? [])[0];
    if (s) {
      return {
        ...baseManualDraft({
          title: `Plano: ${s.title}`,
          objective: s.description || s.title,
        }),
        sourceKind: "scenario",
        sourceId: s.id,
        scenarioId: s.id,
        confidence: s.confidence,
        pipelineSteps: ["from_scenario"],
      };
    }
  }
  if (input.sourceKind === "priority") {
    const p =
      (sources.priorities ?? []).find((x) => x.id === input.sourceId) ??
      (sources.priorities ?? [])[0];
    if (p) {
      return {
        ...baseManualDraft({ title: `Plano: ${p.title}`, objective: p.summary }),
        sourceKind: "priority",
        sourceId: p.id,
        priorityId: p.id,
        confidence: p.confidence,
        pipelineSteps: ["from_priority"],
      };
    }
  }
  if (input.sourceKind === "project") {
    const p =
      (sources.projects ?? []).find((x) => x.id === input.sourceId) ??
      (sources.projects ?? [])[0];
    if (p) {
      return {
        ...baseManualDraft({
          title: `Plano: ${p.name}`,
          objective: p.description || p.name,
        }),
        sourceKind: "project",
        sourceId: p.id,
        projectId: p.id,
        pipelineSteps: ["from_project"],
      };
    }
  }
  if (input.sourceKind === "mission") {
    const m =
      (sources.missions ?? []).find((x) => x.id === input.sourceId) ??
      (sources.missions ?? [])[0];
    if (m) {
      return {
        ...baseManualDraft({
          title: `Plano: ${m.title}`,
          objective: m.objective || m.title,
        }),
        sourceKind: "mission",
        sourceId: m.id,
        missionId: m.id,
        pipelineSteps: ["from_mission"],
      };
    }
  }

  return {
    ...baseManualDraft({
      title: input.title ?? "Novo plano",
      objective: input.objective ?? "Definir objetivo com o usuário",
    }),
    sourceKind: "manual",
    sourceId: null,
  };
}

export function generatePlanPure(
  state: PlanState,
  input: {
    userId: string;
    workspaceId?: string | null;
    sourceKind: PlanSourceKind;
    sourceId?: string | null;
    title?: string;
    objective?: string;
    sources?: Partial<PlanSourceSlice>;
  }
): {
  state: PlanState;
  plan: Plan | null;
  context: PlanContext;
  errors: string[];
} {
  const context = buildPlanContext({
    sources: input.sources,
    correlationId: `plan_run_${Date.now()}`,
  });
  const seed = seedDraftFromSource({
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    title: input.title,
    objective: input.objective,
    sources: context.sources,
  });
  const { draft } = runPlannerRegistry(seed, context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
  });
  const plan = materializeDraft(draft, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    context,
  });
  const validation = validatePlanDraft(plan);
  if (!validation.ok) {
    return {
      state,
      plan: null,
      context,
      errors: validation.errors,
    };
  }

  const ts = nowIso();
  const next: PlanState = {
    ...state,
    plans: [plan, ...state.plans].slice(0, 400),
    lastGeneratedAt: ts,
    audit: [
      {
        id: newPlanId("pau"),
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        planId: plan.id,
        action: "generate",
        summary: `Plano DRAFT gerado a partir de ${input.sourceKind}`,
        metadata: {
          executionInfluence: "none",
          sourceKind: input.sourceKind,
          pipeline: plan.pipelineSteps,
        },
        createdAt: ts,
      },
      ...state.audit,
    ].slice(0, 500),
    notifications: [
      {
        id: newPlanId("pnt"),
        userId: input.userId,
        planId: plan.id,
        kind: "review_requested" as const,
        title: "Plano em rascunho",
        body: `"${plan.title}" aguarda revisão humana antes de aprovação.`,
        createdAt: ts,
        read: false,
      },
      ...state.notifications,
    ].slice(0, 200),
  };

  return { state: next, plan, context, errors: [] };
}

export type PlanListFilters = {
  status?: PlanStatus | PlanStatus[];
  projectId?: string;
  missionId?: string;
  ownerId?: string;
  workspaceId?: string | null;
  limit?: number;
  offset?: number;
};

export function listPlansPure(
  state: PlanState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: PlanListFilters
): Plan[] {
  let rows = state.plans.filter(
    (p) => !p.softDeleted && canViewPlan(p, viewer)
  );
  if (opts?.workspaceId !== undefined) {
    rows = rows.filter((p) => p.workspaceId === opts.workspaceId);
  }
  if (opts?.status) {
    const set = new Set(
      Array.isArray(opts.status) ? opts.status : [opts.status]
    );
    rows = rows.filter((p) => set.has(p.status));
  }
  if (opts?.projectId) rows = rows.filter((p) => p.projectId === opts.projectId);
  if (opts?.missionId) rows = rows.filter((p) => p.missionId === opts.missionId);
  if (opts?.ownerId) rows = rows.filter((p) => p.ownerId === opts.ownerId);
  rows = rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const offset = opts?.offset ?? 0;
  return rows.slice(offset, offset + (opts?.limit ?? 50));
}

export function getPlanPure(
  state: PlanState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  planId: string
): Plan | null {
  const plan = state.plans.find((p) => p.id === planId && !p.softDeleted);
  if (!plan || !canViewPlan(plan, viewer)) return null;
  return plan;
}

export function getHomePlanWidgetPure(
  state: PlanState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): PlanHomeWidget {
  const all = listPlansPure(state, viewer, { limit: 100 });
  const pendingApproval = all
    .filter((p) => p.status === "PENDING_REVIEW" || p.status === "DRAFT")
    .slice(0, 7);
  const active = all
    .filter((p) => p.status === "IN_PROGRESS" || p.status === "APPROVED")
    .slice(0, 7);
  const blockedSteps = all.flatMap((p) =>
    p.steps
      .filter((s) => s.status === "BLOCKED")
      .map((step) => ({ planId: p.id, planTitle: p.title, step }))
  ).slice(0, 7);
  const upcomingMilestones = all.flatMap((p) =>
    p.milestones
      .filter((m) => m.status === "SUGGESTED")
      .map((milestone) => ({
        planId: p.id,
        planTitle: p.title,
        milestone,
      }))
  ).slice(0, 7);
  const withoutOwner = all.filter((p) => !p.ownerId).slice(0, 7);
  return {
    pendingApproval,
    active,
    blockedSteps,
    upcomingMilestones,
    withoutOwner,
  };
}
