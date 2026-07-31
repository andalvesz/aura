/**
 * Recommendation service facade (Sprint 7.3).
 * READ-ONLY consumption of upstream layers. executionInfluence: "none"
 */

import {
  applyRecommendationFeedbackPure,
  collectRecommendationSources,
  explainRecommendationPure,
  generateRecommendationsPure,
  getHomeRecommendationWidgetPure,
  getRecommendationPure,
  getRecommendationState,
  listRecommendationsPure,
  recommendationStoreKey,
  searchRecommendationsPure,
  setRecommendationState,
  type RecommendationCard,
  type RecommendationExplanation,
  type RecommendationFeedbackKind,
  type RecommendationHomeWidget,
  type RecommendationListFilters,
} from "@/lib/recommendation";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: recommendationStoreKey(ctx.userId, ws),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

async function loadReadOnlySources() {
  const sources: Parameters<typeof collectRecommendationSources>[0] = {};

  try {
    const { getIdentityClaims } = await import(
      "@/lib/supabase/services/identity-engine.service"
    );
    const claims = await getIdentityClaims();
    sources.identityHints = claims.slice(0, 20).map((c) => ({
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
    const memories = await listMemories({ limit: 30 });
    sources.memories = memories.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.content?.slice(0, 280) ?? m.title,
      confidence: m.confidence,
      updatedAt: m.updatedAt,
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
    const { listCognitiveArtifacts } = await import(
      "@/lib/supabase/services/cognitive-engine.service"
    );
    const arts = await listCognitiveArtifacts({ limit: 30 });
    sources.cognitiveArtifacts = arts.map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      artifactType: a.artifactType,
      confidence: a.confidence,
      status: a.status,
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
      updatedAt: d.updatedAt,
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
      updatedAt: d.updatedAt,
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
      updatedAt: p.updatedAt,
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
    const { listDecisionCards } = await import(
      "@/lib/supabase/services/decision-support.service"
    );
    const decisions = await listDecisionCards({ limit: 30, ranked: true });
    sources.decisions = decisions.map((d) => ({
      id: d.id,
      title: d.title,
      summary: d.summary,
      kind: d.kind,
      confidence: d.confidence,
      impact: d.impact,
      urgency: d.urgency,
      status: d.status,
      updatedAt: d.updatedAt,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listScenarioCards } = await import(
      "@/lib/supabase/services/scenario.service"
    );
    const scenarios = await listScenarioCards({ limit: 30 });
    sources.scenarios = scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      confidence: s.confidence,
      impact: s.impact,
      status: s.status,
      updatedAt: s.updatedAt,
    }));
  } catch {
    /* ignore */
  }

  try {
    const { listPriorityItems } = await import(
      "@/lib/supabase/services/prioritization.service"
    );
    const priorities = await listPriorityItems({ limit: 30, ranked: true });
    sources.priorities = priorities.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      kind: p.kind,
      confidence: p.confidence,
      priorityScore: p.priorityScore,
      impact: p.impact,
      urgency: p.urgency,
      status: p.status,
      updatedAt: p.updatedAt,
    }));
  } catch {
    /* ignore */
  }

  return collectRecommendationSources(sources);
}

export async function generateRecommendations(): Promise<{
  items: RecommendationCard[];
  rejectedCount: number;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const sources = await loadReadOnlySources();
  const res = generateRecommendationsPure(getRecommendationState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    sources,
  });
  setRecommendationState(key, res.state);
  return { items: res.items, rejectedCount: res.rejectedCount, error: null };
}

export async function listRecommendationItems(
  opts?: RecommendationListFilters
): Promise<RecommendationCard[]> {
  const { key, viewer } = await ctxKey();
  return listRecommendationsPure(getRecommendationState(key), viewer, opts);
}

export async function getRecommendationItem(
  recommendationId: string
): Promise<RecommendationCard | null> {
  const { key, viewer } = await ctxKey();
  return getRecommendationPure(
    getRecommendationState(key),
    viewer,
    recommendationId
  );
}

export async function submitRecommendationFeedback(input: {
  recommendationId: string;
  kind: RecommendationFeedbackKind;
  note?: string | null;
}): Promise<{
  item: RecommendationCard | null;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const res = applyRecommendationFeedbackPure(getRecommendationState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    recommendationId: input.recommendationId,
    kind: input.kind,
    note: input.note,
  });
  if (res.error) return { item: null, error: res.error };
  setRecommendationState(key, res.state);
  return { item: res.item, error: null };
}

export async function explainRecommendationItem(
  recommendationId: string
): Promise<RecommendationExplanation | null> {
  const item = await getRecommendationItem(recommendationId);
  if (!item) return null;
  return explainRecommendationPure(item);
}

export async function searchRecommendationItems(
  query: string,
  limit = 20
): Promise<RecommendationCard[]> {
  const { key, viewer } = await ctxKey();
  return searchRecommendationsPure(getRecommendationState(key), viewer, query, {
    limit,
  });
}

export async function getHomeRecommendationWidget(): Promise<RecommendationHomeWidget> {
  const { key, viewer } = await ctxKey();
  return getHomeRecommendationWidgetPure(getRecommendationState(key), viewer);
}

export async function listRecommendationAudit(limit = 40) {
  const { key } = await ctxKey();
  return getRecommendationState(key).audit.slice(0, limit);
}
