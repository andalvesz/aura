/**
 * Planner service facade (Sprint 8.0).
 * READ-ONLY upstream. executionInfluence: "none"
 */

import {
  addPlanCommentPure,
  approvePlanPure,
  archivePlanPure,
  assignCollaboratorPure,
  applyPlanFeedbackPure,
  completePlanPure,
  completeStepPure,
  duplicatePlanPure,
  explainPlanPure,
  generatePlanPure,
  getHomePlanWidgetPure,
  getPlanPure,
  getPlanState,
  listPlansPure,
  pausePlanPure,
  planStoreKey,
  rejectPlanPure,
  reorderStepsPure,
  searchPlanEntitiesPure,
  searchPlansPure,
  setPlanState,
  startPlanPure,
  submitPlanForReviewPure,
  type Plan,
  type PlanExplanation,
  type PlanFeedbackKind,
  type PlanHomeWidget,
  type PlanListFilters,
  type PlanRole,
  type PlanSourceKind,
  type PlanStatus,
} from "@/lib/planner";
import { collectPlanSources } from "@/lib/planner/providers/sources";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: planStoreKey(ctx.userId, ws),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

async function loadReadOnlySources() {
  const sources: Parameters<typeof collectPlanSources>[0] = {};

  try {
    const { getIdentityClaims } = await import(
      "@/lib/supabase/services/identity-engine.service"
    );
    const claims = await getIdentityClaims();
    sources.identityHints = claims.slice(0, 15).map((c) => ({
      id: c.id,
      title: c.label || c.key,
      summary: c.description || String(c.value ?? ""),
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listMemories } = await import(
      "@/lib/supabase/services/memory-engine.service"
    );
    sources.memories = (await listMemories({ limit: 20 })).map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.content?.slice(0, 200),
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listWorldEntities } = await import(
      "@/lib/supabase/services/world-model.service"
    );
    sources.worldEntities = (await listWorldEntities({ limit: 20 })).map(
      (e) => ({
        id: e.id,
        name: e.displayName,
        entityType: e.entityType,
      })
    );
  } catch {
    /* ignore */
  }

  try {
    const { listCognitiveArtifacts } = await import(
      "@/lib/supabase/services/cognitive-engine.service"
    );
    sources.cognitiveArtifacts = (
      await listCognitiveArtifacts({ limit: 20 })
    ).map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      confidence: a.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listDiscoveries } = await import(
      "@/lib/supabase/services/discovery-engine.service"
    );
    sources.discoveries = (await listDiscoveries({ limit: 20 })).map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      type: d.type,
      confidence: d.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listKnowledgeDocuments } = await import(
      "@/lib/supabase/services/knowledge-hub.service"
    );
    const docs = await listKnowledgeDocuments({ limit: 20 });
    sources.knowledgeDocuments = docs.items.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listProjects, listBusinesses } = await import(
      "@/lib/supabase/services/projects.service"
    );
    sources.projects = (
      await listProjects({ includeArchived: false, limit: 30 })
    ).map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      description: p.description,
    }));
    sources.businesses = (await listBusinesses()).map((b) => ({
      id: b.id,
      name: b.name,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listDecisionCards } = await import(
      "@/lib/supabase/services/decision-support.service"
    );
    sources.decisions = (
      await listDecisionCards({ limit: 20, ranked: true })
    ).map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      confidence: d.confidence,
      status: d.status,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listScenarioCards } = await import(
      "@/lib/supabase/services/scenario.service"
    );
    sources.scenarios = (await listScenarioCards({ limit: 20 })).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      confidence: s.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listPriorityItems } = await import(
      "@/lib/supabase/services/prioritization.service"
    );
    sources.priorities = (
      await listPriorityItems({ limit: 20, ranked: true })
    ).map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      confidence: p.confidence,
      priorityScore: p.priorityScore,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listRecommendationItems } = await import(
      "@/lib/supabase/services/recommendation.service"
    );
    sources.recommendations = (
      await listRecommendationItems({ limit: 30, ranked: true })
    ).map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      recommendationType: r.recommendationType,
      confidence: r.confidence,
      status: r.status,
      relatedProject: r.relatedProject,
      relatedDecision: r.relatedDecision,
      relatedScenario: r.relatedScenario,
      relatedPriority: r.relatedPriority,
      relatedDiscovery: r.relatedDiscovery,
      evidence: r.evidence.map((e) => ({ summary: e.summary })),
      limitations: r.limitations,
      alternatives: r.alternatives,
      reasoning: r.reasoning,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { getMissionEngine } = await import(
      "@/lib/supabase/services/mission.service"
    );
    const engine = await getMissionEngine({ skipDb: true });
    sources.missions = engine.missions.slice(0, 20).map((m) => ({
      id: m.id,
      title: m.title,
      objective: m.description || m.title,
      status: m.status,
    }));
  } catch {
    /* ignore */
  }

  return collectPlanSources(sources);
}

export async function generatePlan(input: {
  sourceKind: PlanSourceKind;
  sourceId?: string | null;
  title?: string;
  objective?: string;
}): Promise<{ plan: Plan | null; errors: string[]; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const sources = await loadReadOnlySources();
  const res = generatePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    title: input.title,
    objective: input.objective,
    sources,
  });
  setPlanState(key, res.state);
  return {
    plan: res.plan,
    errors: res.errors,
    error: res.errors.length ? res.errors.join(", ") : null,
  };
}

export async function listPlanItems(
  opts?: PlanListFilters
): Promise<Plan[]> {
  const { key, viewer } = await ctxKey();
  return listPlansPure(getPlanState(key), viewer, opts);
}

export async function getPlanItem(planId: string): Promise<Plan | null> {
  const { key, viewer } = await ctxKey();
  return getPlanPure(getPlanState(key), viewer, planId);
}

export async function submitPlanForReview(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = submitPlanForReviewPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function approvePlan(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = approvePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function rejectPlan(planId: string, note?: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = rejectPlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
    note,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function startPlan(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = startPlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function pausePlan(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = pausePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function completePlanStep(planId: string, stepId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = completeStepPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
    stepId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function completePlan(planId: string, force?: boolean) {
  const { ctx, ws, key } = await ctxKey();
  const res = completePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
    force,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function archivePlan(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = archivePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function duplicatePlan(planId: string) {
  const { ctx, ws, key } = await ctxKey();
  const res = duplicatePlanPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function reorderPlanSteps(
  planId: string,
  stepIdsInOrder: string[]
) {
  const { ctx, ws, key } = await ctxKey();
  const res = reorderStepsPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    planId,
    stepIdsInOrder,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function submitPlanFeedback(input: {
  planId: string;
  stepId?: string | null;
  kind: PlanFeedbackKind;
  note?: string | null;
}) {
  const { ctx, ws, key } = await ctxKey();
  const res = applyPlanFeedbackPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    ...input,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function addPlanComment(input: {
  planId: string;
  body: string;
  mentions?: string[];
}) {
  const { ctx, ws, key } = await ctxKey();
  const res = addPlanCommentPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    ...input,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function assignPlanCollaborator(input: {
  planId: string;
  targetUserId: string;
  role: PlanRole;
}) {
  const { ctx, ws, key } = await ctxKey();
  const res = assignCollaboratorPure(getPlanState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    ...input,
  });
  if (!res.error) setPlanState(key, res.state);
  return res;
}

export async function explainPlanItem(
  planId: string
): Promise<PlanExplanation | null> {
  const plan = await getPlanItem(planId);
  if (!plan) return null;
  return explainPlanPure(plan);
}

export async function searchPlanItems(query: string, limit = 20) {
  const { key, viewer } = await ctxKey();
  return searchPlanEntitiesPure(getPlanState(key), viewer, query, { limit });
}

export async function searchPlanHits(query: string, limit = 40) {
  const { key, viewer } = await ctxKey();
  return searchPlansPure(getPlanState(key), viewer, query, { limit });
}

export async function getHomePlanWidget(): Promise<PlanHomeWidget> {
  const { key, viewer } = await ctxKey();
  return getHomePlanWidgetPure(getPlanState(key), viewer);
}

export async function listPlanAudit(limit = 40) {
  const { key } = await ctxKey();
  return getPlanState(key).audit.slice(0, limit);
}

export async function listPlanComments(planId: string) {
  const { key } = await ctxKey();
  return getPlanState(key).comments.filter((c) => c.planId === planId);
}

export async function listPlanNotifications(limit = 30) {
  const { key, viewer } = await ctxKey();
  return getPlanState(key)
    .notifications.filter((n) => n.userId === viewer.userId)
    .slice(0, limit);
}

export type { PlanStatus };
