/**
 * Scenario Engine service facade (Sprint 7.1).
 * READ-ONLY upstream. executionInfluence: "none"
 */

import {
  applyScenarioFeedbackPure,
  collectScenarioSources,
  compareScenariosPure,
  explainScenarioPure,
  getHomeScenarioWidgetPure,
  getScenarioPure,
  getScenarioState,
  listScenariosPure,
  scenarioStoreKey,
  searchScenariosPure,
  setScenarioState,
  simulateScenariosPure,
  type ScenarioCard,
  type ScenarioComparison,
  type ScenarioExplanation,
  type ScenarioFeedbackKind,
  type ScenarioHomeWidget,
  type ScenarioStatus,
} from "@/lib/scenario";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: scenarioStoreKey(ctx.userId, ws),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

async function loadReadOnlySources() {
  const sources: Parameters<typeof collectScenarioSources>[0] = {};

  try {
    const { listMemories } = await import(
      "@/lib/supabase/services/memory-engine.service"
    );
    const memories = await listMemories({ limit: 30 });
    sources.memories = memories.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.content?.slice(0, 280) ?? m.title,
      confidence: m.confidence,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listDiscoveries } = await import(
      "@/lib/supabase/services/discovery-engine.service"
    );
    const discoveries = await listDiscoveries({ limit: 30 });
    sources.discoveries = discoveries.map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      type: d.type,
      confidence: d.confidence,
      impact: d.impact,
      urgency: d.urgency,
      status: d.status,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listKnowledgeDocuments } = await import(
      "@/lib/supabase/services/knowledge-hub.service"
    );
    const docs = await listKnowledgeDocuments({ limit: 30 });
    sources.knowledgeDocuments = docs.items.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      summary: d.summary,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listProjects, listBusinesses } = await import(
      "@/lib/supabase/services/projects.service"
    );
    const projects = await listProjects({ includeArchived: false, limit: 40 });
    sources.projects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      description: p.description,
      businessId: p.businessId,
    }));
    const businesses = await listBusinesses();
    sources.businesses = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      segment: b.segment,
      description: b.description,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listWorldEntities } = await import(
      "@/lib/supabase/services/world-model.service"
    );
    const entities = await listWorldEntities({ limit: 30 });
    sources.worldEntities = entities.map((e) => ({
      id: e.id,
      name: e.displayName,
      entityType: e.entityType,
      summary: e.description,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listDecisionCards } = await import(
      "@/lib/supabase/services/decision-support.service"
    );
    const decisions = await listDecisionCards({ limit: 30 });
    sources.decisions = decisions.map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      kind: d.kind,
      confidence: d.confidence,
      status: d.status,
    }));
  } catch {
    /* ignore */
  }

  return collectScenarioSources(sources);
}

export async function simulateScenarios(input?: {
  whatIfPrompt?: string | null;
  relatedDecisionId?: string | null;
  relatedProjectId?: string | null;
  whatIfOnly?: boolean;
}): Promise<{
  scenarios: ScenarioCard[];
  rejectedCount: number;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const sources = await loadReadOnlySources();
  const res = simulateScenariosPure(getScenarioState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    sources,
    whatIfPrompt: input?.whatIfPrompt,
    relatedDecisionId: input?.relatedDecisionId,
    relatedProjectId: input?.relatedProjectId,
    engineIds: input?.whatIfOnly
      ? ["what_if_v1"]
      : input?.whatIfPrompt
        ? ["what_if_v1", "best_case_v1", "worst_case_v1", "most_likely_v1"]
        : undefined,
  });
  setScenarioState(key, res.state);
  return {
    scenarios: res.scenarios,
    rejectedCount: res.rejectedCount,
    error: null,
  };
}

export async function listScenarioCards(opts?: {
  status?: ScenarioStatus | ScenarioStatus[];
  limit?: number;
  includeDiscarded?: boolean;
}): Promise<ScenarioCard[]> {
  const { key, viewer } = await ctxKey();
  return listScenariosPure(getScenarioState(key), viewer, opts);
}

export async function getScenarioCard(
  scenarioId: string
): Promise<ScenarioCard | null> {
  const { key, viewer } = await ctxKey();
  return getScenarioPure(getScenarioState(key), viewer, scenarioId);
}

export async function submitScenarioFeedback(input: {
  scenarioId: string;
  kind: ScenarioFeedbackKind;
  note?: string | null;
}): Promise<{ card: ScenarioCard | null; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const res = applyScenarioFeedbackPure(getScenarioState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    scenarioId: input.scenarioId,
    kind: input.kind,
    note: input.note,
  });
  if (res.error) return { card: null, error: res.error };
  setScenarioState(key, res.state);
  return { card: res.card, error: null };
}

export async function compareScenarioCards(input: {
  scenarioIds: string[];
  title?: string;
}): Promise<{ comparison: ScenarioComparison | null; error: string | null }> {
  const { ctx, ws, key } = await ctxKey();
  const res = compareScenariosPure(getScenarioState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    scenarioIds: input.scenarioIds,
    title: input.title,
  });
  if (res.error) return { comparison: null, error: res.error };
  setScenarioState(key, res.state);
  return { comparison: res.comparison, error: null };
}

export async function explainScenarioCard(
  scenarioId: string
): Promise<ScenarioExplanation | null> {
  const card = await getScenarioCard(scenarioId);
  if (!card) return null;
  return explainScenarioPure(card);
}

export async function searchScenarioCards(
  query: string,
  limit = 20
): Promise<ScenarioCard[]> {
  const { key, viewer } = await ctxKey();
  return searchScenariosPure(getScenarioState(key), viewer, query, { limit });
}

export async function getHomeScenarioWidget(): Promise<ScenarioHomeWidget> {
  const { key, viewer } = await ctxKey();
  return getHomeScenarioWidgetPure(getScenarioState(key), viewer);
}

export async function listScenarioComparisons(limit = 20) {
  const { key, ctx } = await ctxKey();
  return getScenarioState(key)
    .comparisons.filter((c) => c.userId === ctx.userId)
    .slice(0, limit);
}
