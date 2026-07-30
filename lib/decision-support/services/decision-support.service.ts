/**
 * Decision Support service facade (Sprint 7.0).
 * READ-ONLY consumption of upstream layers. executionInfluence: "none"
 */

import {
  applyDecisionFeedbackPure,
  collectDecisionSources,
  decisionStoreKey,
  explainDecisionPure,
  generateDecisionsPure,
  getDecisionPure,
  getDecisionState,
  getHomeDecisionWidgetPure,
  listDecisionsPure,
  searchDecisionsPure,
  setDecisionState,
  type DecisionCard,
  type DecisionExplanation,
  type DecisionFeedbackKind,
  type DecisionHomeWidget,
  type DecisionStatus,
} from "@/lib/decision-support";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxKey() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  return {
    ctx,
    ws,
    key: decisionStoreKey(ctx.userId, ws),
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

async function loadReadOnlySources() {
  const sources: Parameters<typeof collectDecisionSources>[0] = {};

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

  return collectDecisionSources(sources);
}

export async function generateDecisionSupport(): Promise<{
  cards: DecisionCard[];
  rejectedCount: number;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const sources = await loadReadOnlySources();
  const res = generateDecisionsPure(getDecisionState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    sources,
  });
  setDecisionState(key, res.state);
  return { cards: res.cards, rejectedCount: res.rejectedCount, error: null };
}

export async function listDecisionCards(opts?: {
  status?: DecisionStatus | DecisionStatus[];
  kind?: DecisionCard["kind"];
  limit?: number;
  ranked?: boolean;
}): Promise<DecisionCard[]> {
  const { key, viewer } = await ctxKey();
  return listDecisionsPure(getDecisionState(key), viewer, opts);
}

export async function getDecisionCard(
  decisionId: string
): Promise<DecisionCard | null> {
  const { key, viewer } = await ctxKey();
  return getDecisionPure(getDecisionState(key), viewer, decisionId);
}

export async function submitDecisionFeedback(input: {
  decisionId: string;
  kind: DecisionFeedbackKind;
  note?: string | null;
}): Promise<{
  card: DecisionCard | null;
  error: string | null;
}> {
  const { ctx, ws, key } = await ctxKey();
  const res = applyDecisionFeedbackPure(getDecisionState(key), {
    userId: ctx.userId,
    workspaceId: ws,
    decisionId: input.decisionId,
    kind: input.kind,
    note: input.note,
  });
  if (res.error) return { card: null, error: res.error };
  setDecisionState(key, res.state);
  return { card: res.card, error: null };
}

export async function explainDecisionCard(
  decisionId: string
): Promise<DecisionExplanation | null> {
  const card = await getDecisionCard(decisionId);
  if (!card) return null;
  return explainDecisionPure(card);
}

export async function searchDecisionCards(
  query: string,
  limit = 20
): Promise<DecisionCard[]> {
  const { key, viewer } = await ctxKey();
  return searchDecisionsPure(getDecisionState(key), viewer, query, { limit });
}

export async function getHomeDecisionWidget(): Promise<DecisionHomeWidget> {
  const { key, viewer } = await ctxKey();
  return getHomeDecisionWidgetPure(getDecisionState(key), viewer);
}

export async function listDecisionAudit(limit = 40) {
  const { key } = await ctxKey();
  return getDecisionState(key).audit.slice(0, limit);
}
