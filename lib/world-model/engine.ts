/**
 * Pure World Model engine — no DB, no auth.
 */

import {
  clampScore,
  confidenceBand,
  initialEntityConfidence,
  initialRelationshipConfidence,
  isIsolatedSource,
  projectionConfidenceFrom,
} from "@/lib/world-model/confidence";
import {
  assertEntityType,
  defaultSensitivityForEntity,
  filterAllowedAttributes,
} from "@/lib/world-model/entity-registry";
import { assertWorldPrivacy } from "@/lib/world-model/privacy";
import {
  assertRelationshipCompatibility,
  getRelationshipTypeDefinition,
} from "@/lib/world-model/relationship-registry";
import {
  buildCanonicalKey,
  findEntityCandidates,
  resolveEntity,
} from "@/lib/world-model/resolution";
import type {
  CreateWorldEntityInput,
  CreateWorldRelationshipInput,
  ProjectionReport,
  SourceReference,
  WorldAuditEvent,
  WorldBrainContext,
  WorldEntity,
  WorldEntityFilters,
  WorldNeighborFilters,
  WorldPath,
  WorldRelationship,
  WorldSuppression,
} from "@/lib/world-model/types";
import {
  VALID_RELATIONSHIP_STATUSES,
} from "@/lib/world-model/types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export type WorldModelState = {
  entities: WorldEntity[];
  relationships: WorldRelationship[];
  suppressions: WorldSuppression[];
  audits: WorldAuditEvent[];
};

export function createEmptyWorldState(): WorldModelState {
  return { entities: [], relationships: [], suppressions: [], audits: [] };
}

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  state: WorldModelState;
  data: T | null;
};

function audit(
  state: WorldModelState,
  event: Omit<WorldAuditEvent, "id" | "createdAt"> & { createdAt?: string }
): WorldModelState {
  const entry: WorldAuditEvent = {
    id: uid("waud"),
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  };
  return { ...state, audits: [entry, ...state.audits].slice(0, 1000) };
}

function snapE(e: WorldEntity): Record<string, unknown> {
  return {
    id: e.id,
    status: e.status,
    displayName: e.displayName,
    confidence: e.confidence,
    canonicalKey: e.canonicalKey,
  };
}

function snapR(r: WorldRelationship): Record<string, unknown> {
  return {
    id: r.id,
    status: r.status,
    relationshipType: r.relationshipType,
    confidence: r.confidence,
    sourceEntityId: r.sourceEntityId,
    targetEntityId: r.targetEntityId,
  };
}

function isSuppressed(
  state: WorldModelState,
  userId: string,
  kind: "entity" | "relationship",
  sourceType: string,
  sourceReference: SourceReference | null,
  relationshipType?: string | null
): boolean {
  if (!sourceReference) return false;
  return state.suppressions.some(
    (s) =>
      s.userId === userId &&
      s.kind === kind &&
      s.sourceType === sourceType &&
      s.sourceReference.entityType === sourceReference.entityType &&
      s.sourceReference.entityId === sourceReference.entityId &&
      (kind === "entity" ||
        s.relationshipType == null ||
        s.relationshipType === relationshipType)
  );
}

export function createWorldEntityPure(
  state: WorldModelState,
  userId: string,
  input: CreateWorldEntityInput
): EngineResult<WorldEntity> {
  const typeOk = assertEntityType(input.entityType);
  if (!typeOk.ok) return { ok: false, error: typeOk.reason, state, data: null };

  const privacy = assertWorldPrivacy({
    displayName: input.displayName,
    description: input.description,
    entityType: input.entityType,
    sourceType: input.sourceType,
    sensitivity: input.sensitivity,
  });
  if (!privacy.ok) return { ok: false, error: privacy.reason, state, data: null };

  if (isIsolatedSource(input.sourceType) && input.entityType === "goal") {
    return {
      ok: false,
      error: "Pesquisa/observação isolada não cria objetivo no World Model",
      state,
      data: null,
    };
  }

  if (
    isSuppressed(
      state,
      userId,
      "entity",
      input.sourceType,
      input.sourceReference ?? null
    )
  ) {
    return {
      ok: false,
      error: "Projeção suprimida — rejeitada anteriormente sem nova evidência",
      state,
      data: null,
    };
  }

  const workspaceId = input.workspaceId ?? null;
  const canonicalKey =
    input.canonicalKey ??
    buildCanonicalKey({
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      entityType: input.entityType,
      contextualKey: input.displayName,
      userId,
      workspaceId,
    });

  const resolved = resolveEntity(state.entities, {
    userId,
    workspaceId,
    entityType: input.entityType,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
    externalReference: input.externalReference,
    canonicalKey,
    displayName: input.displayName,
  });

  const at = new Date().toISOString();

  if (resolved.entity && !resolved.ambiguous) {
    // Idempotent update of allowed attributes
    const updated: WorldEntity = {
      ...resolved.entity,
      displayName: input.displayName.trim() || resolved.entity.displayName,
      description: input.description ?? resolved.entity.description,
      attributes: {
        ...resolved.entity.attributes,
        ...filterAllowedAttributes(input.entityType, input.attributes ?? {}),
      },
      lastObservedAt: at,
      updatedAt: at,
      status:
        resolved.entity.status === "REJECTED" ||
        resolved.entity.status === "ARCHIVED"
          ? resolved.entity.status
          : input.confirmNow
            ? "CONFIRMED"
            : resolved.entity.status,
    };
    // Never revive REJECTED silently
    if (resolved.entity.status === "REJECTED") {
      return {
        ok: true,
        error: null,
        state: audit(state, {
          userId,
          workspaceId,
          entityId: resolved.entity.id,
          relationshipId: null,
          action: "projection_suppressed",
          previousState: snapE(resolved.entity),
          nextState: null,
          sourceType: input.sourceType,
          reason: "Entidade rejeitada — sem recriação silenciosa",
          correlationId: null,
        }),
        data: resolved.entity,
      };
    }
    let next: WorldModelState = {
      ...state,
      entities: state.entities.map((e) =>
        e.id === updated.id ? updated : e
      ),
    };
    next = audit(next, {
      userId,
      workspaceId,
      entityId: updated.id,
      relationshipId: null,
      action: "entity_updated",
      previousState: snapE(resolved.entity),
      nextState: snapE(updated),
      sourceType: input.sourceType,
      reason: "Projeção idempotente (update)",
      correlationId: null,
    });
    return { ok: true, error: null, state: next, data: updated };
  }

  if (resolved.ambiguous) {
    return {
      ok: false,
      error: "Resolução ambígua — preferir revisão a merge por nome",
      state,
      data: null,
    };
  }

  const confidence = initialEntityConfidence({
    sourceType: input.sourceType,
    confirmNow: input.confirmNow,
    explicit: input.confidence,
  });

  const entity: WorldEntity = {
    id: uid("went"),
    userId,
    workspaceId,
    entityType: input.entityType,
    canonicalKey,
    displayName: input.displayName.trim(),
    description: input.description?.trim() ?? "",
    status: input.confirmNow
      ? "CONFIRMED"
      : input.status ?? "ACTIVE",
    confidence,
    confidenceBand: confidenceBand(confidence),
    importance: clampScore(input.importance ?? 50),
    sensitivity:
      privacy.forceSensitivity ??
      input.sensitivity ??
      defaultSensitivityForEntity(input.entityType),
    context: input.context?.trim() || "general",
    attributes: filterAllowedAttributes(input.entityType, input.attributes ?? {}),
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    externalReference: input.externalReference ?? null,
    aliases: [],
    validFrom: input.validFrom ?? at,
    validUntil: input.validUntil ?? null,
    firstObservedAt: at,
    lastObservedAt: at,
    mergedIntoId: null,
    scoreHistory: [
      {
        at,
        field: "confidence",
        from: 0,
        to: confidence,
        reason: "criação",
        actor: "system",
      },
    ],
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    deletedAt: null,
    metadata: input.metadata ?? {},
  };

  let next: WorldModelState = {
    ...state,
    entities: [entity, ...state.entities],
  };
  next = audit(next, {
    userId,
    workspaceId,
    entityId: entity.id,
    relationshipId: null,
    action: "entity_created",
    previousState: null,
    nextState: snapE(entity),
    sourceType: input.sourceType,
    reason: "Entidade criada",
    correlationId: null,
  });
  next = audit(next, {
    userId,
    workspaceId,
    entityId: entity.id,
    relationshipId: null,
    action: "projection_created",
    previousState: null,
    nextState: snapE(entity),
    sourceType: input.sourceType,
    reason: "Projeção registrada",
    correlationId: null,
  });

  return { ok: true, error: null, state: next, data: entity };
}

export function createWorldRelationshipPure(
  state: WorldModelState,
  userId: string,
  input: CreateWorldRelationshipInput
): EngineResult<WorldRelationship> {
  const source = state.entities.find(
    (e) => e.id === input.sourceEntityId && e.userId === userId
  );
  const target = state.entities.find(
    (e) => e.id === input.targetEntityId && e.userId === userId
  );
  if (!source || !target) {
    return { ok: false, error: "Entidades source/target não encontradas", state, data: null };
  }
  if (source.userId !== target.userId) {
    return { ok: false, error: "Relações cross-user proibidas", state, data: null };
  }

  const compat = assertRelationshipCompatibility({
    relationshipType: input.relationshipType,
    sourceEntityType: source.entityType,
    targetEntityType: target.entityType,
    context: input.context,
    sourceEntityId: source.id,
    targetEntityId: target.id,
  });
  if (!compat.ok) return { ok: false, error: compat.reason, state, data: null };

  if (isIsolatedSource(input.sourceType)) {
    if (
      input.relationshipType === "INTERESTED_IN" ||
      input.relationshipType === "HAS_GOAL" ||
      input.relationshipType === "HAS_MISSION"
    ) {
      return {
        ok: false,
        error: "Fonte isolada não cria interesse, objetivo ou missão",
        state,
        data: null,
      };
    }
  }

  if (input.relationshipType === "FOUNDER_OF") {
    if (
      input.sourceType !== "user_explicit" &&
      input.sourceType !== "manual_entry" &&
      input.sourceType !== "identity_engine" &&
      !input.confirmNow
    ) {
      return {
        ok: false,
        error: "FOUNDER_OF exige declaração explícita ou claim confirmada",
        state,
        data: null,
      };
    }
  }

  if (
    isSuppressed(
      state,
      userId,
      "relationship",
      input.sourceType,
      input.sourceReference ?? null,
      input.relationshipType
    )
  ) {
    return {
      ok: false,
      error: "Relação suprimida — não recriar sem nova evidência",
      state,
      data: null,
    };
  }

  // Idempotency by sourceReference + type + endpoints
  const existing = state.relationships.find(
    (r) =>
      r.userId === userId &&
      r.status !== "DELETED" &&
      r.relationshipType === input.relationshipType &&
      r.sourceEntityId === input.sourceEntityId &&
      r.targetEntityId === input.targetEntityId &&
      ((input.sourceReference &&
        r.sourceReference?.entityType === input.sourceReference.entityType &&
        r.sourceReference?.entityId === input.sourceReference.entityId) ||
        (!input.sourceReference &&
          r.sourceType === input.sourceType &&
          !r.sourceReference))
  );

  const at = new Date().toISOString();
  const def = getRelationshipTypeDefinition(input.relationshipType);

  if (existing) {
    if (existing.status === "REJECTED") {
      return {
        ok: true,
        error: null,
        state: audit(state, {
          userId,
          workspaceId: existing.workspaceId,
          entityId: null,
          relationshipId: existing.id,
          action: "projection_suppressed",
          previousState: snapR(existing),
          nextState: null,
          sourceType: input.sourceType,
          reason: "Relação rejeitada — sem reativação silenciosa",
          correlationId: null,
        }),
        data: existing,
      };
    }
    const updated: WorldRelationship = {
      ...existing,
      lastObservedAt: at,
      updatedAt: at,
      evidence: [
        ...existing.evidence,
        {
          id: uid("wevid"),
          observedAt: at,
          sourceType: input.sourceType,
          sourceReference: input.sourceReference ?? null,
          summary: input.evidenceSummary ?? "reobservação",
          strength: 10,
        },
      ].slice(0, 40),
      // identical reobserve must not inflate confidence
    };
    let next: WorldModelState = {
      ...state,
      relationships: state.relationships.map((r) =>
        r.id === existing.id ? updated : r
      ),
    };
    next = audit(next, {
      userId,
      workspaceId: existing.workspaceId,
      entityId: null,
      relationshipId: existing.id,
      action: "projection_skipped",
      previousState: snapR(existing),
      nextState: snapR(updated),
      sourceType: input.sourceType,
      reason: "Idempotente — evidência anexada sem inflar confidence",
      correlationId: null,
    });
    return { ok: true, error: null, state: next, data: updated };
  }

  const confidence = initialRelationshipConfidence({
    sourceType: input.sourceType,
    relationshipType: input.relationshipType,
    confirmNow: input.confirmNow,
    explicit: input.confidence,
  });
  const projConf = projectionConfidenceFrom({
    sourceConfidence: confidence,
    entityOrRelConfidence: Math.min(source.confidence, target.confidence),
  });

  const rel: WorldRelationship = {
    id: uid("wrel"),
    userId,
    workspaceId: input.workspaceId ?? source.workspaceId,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    relationshipType: input.relationshipType,
    direction: def?.symmetric ? "symmetric" : "forward",
    status: input.confirmNow
      ? "CONFIRMED"
      : input.status ??
        (def?.confidencePolicy === "inferred_low"
          ? "HYPOTHESIS"
          : "ACTIVE"),
    confidence,
    confidenceBand: confidenceBand(confidence),
    weight: clampScore(input.weight ?? confidence),
    importance: clampScore(input.importance ?? 50),
    context: input.context?.trim() || source.context,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    evidence: [
      {
        id: uid("wevid"),
        observedAt: at,
        sourceType: input.sourceType,
        sourceReference: input.sourceReference ?? null,
        summary: input.evidenceSummary ?? "criação de relação",
        strength: input.confirmNow ? 90 : 50,
      },
    ],
    projectionConfidence: projConf,
    validFrom: input.validFrom ?? at,
    validUntil: input.validUntil ?? null,
    firstObservedAt: at,
    lastObservedAt: at,
    supersedesRelationshipId: null,
    supersededByRelationshipId: null,
    scoreHistory: [
      {
        at,
        field: "confidence",
        from: 0,
        to: confidence,
        reason: "criação",
        actor: "system",
      },
      {
        at,
        field: "projectionConfidence",
        from: 0,
        to: projConf,
        reason: "projeção",
        actor: "system",
      },
    ],
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    deletedAt: null,
    metadata: input.metadata ?? {},
  };

  let next: WorldModelState = {
    ...state,
    relationships: [rel, ...state.relationships],
  };
  next = audit(next, {
    userId,
    workspaceId: rel.workspaceId,
    entityId: null,
    relationshipId: rel.id,
    action: "relationship_created",
    previousState: null,
    nextState: snapR(rel),
    sourceType: input.sourceType,
    reason: "Relação criada",
    correlationId: null,
  });

  return { ok: true, error: null, state: next, data: rel };
}

export function getWorldEntityPure(
  state: WorldModelState,
  userId: string,
  id: string
): WorldEntity | null {
  const e = state.entities.find((x) => x.id === id && x.userId === userId);
  if (!e || e.status === "DELETED" || e.deletedAt) return null;
  return e;
}

export function searchWorldEntitiesPure(
  state: WorldModelState,
  userId: string,
  filters: WorldEntityFilters = {}
): { items: WorldEntity[]; nextCursor: string | null } {
  const limit = Math.min(filters.limit ?? 40, 100);
  let items = state.entities.filter((e) => e.userId === userId);
  if (filters.workspaceId !== undefined) {
    items = items.filter((e) => e.workspaceId === filters.workspaceId);
  }
  if (!filters.includeDeleted) {
    items = items.filter((e) => e.status !== "DELETED" && !e.deletedAt);
  }
  if (!filters.includeArchived) {
    items = items.filter((e) => e.status !== "ARCHIVED");
  }
  if (filters.entityType) {
    const types = Array.isArray(filters.entityType)
      ? filters.entityType
      : [filters.entityType];
    items = items.filter((e) => types.includes(e.entityType));
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    items = items.filter((e) => statuses.includes(e.status));
  }
  if (filters.context) {
    items = items.filter((e) => e.context === filters.context);
  }
  if (typeof filters.minConfidence === "number") {
    items = items.filter((e) => e.confidence >= filters.minConfidence!);
  }
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    items = items.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.canonicalKey.toLowerCase().includes(q)
    );
  }
  items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  let start = 0;
  if (filters.cursor) {
    const idx = items.findIndex((e) => e.id === filters.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = items.slice(start, start + limit);
  const nextCursor =
    start + limit < items.length ? page[page.length - 1]?.id ?? null : null;
  return { items: page, nextCursor };
}

export function listWorldEntitiesPure(
  state: WorldModelState,
  userId: string,
  filters?: WorldEntityFilters
): WorldEntity[] {
  return searchWorldEntitiesPure(state, userId, filters).items;
}

export function getEntityNeighborsPure(
  state: WorldModelState,
  userId: string,
  entityId: string,
  filters: WorldNeighborFilters = {}
): {
  neighbors: Array<{
    entity: WorldEntity;
    relationship: WorldRelationship;
    direction: "outgoing" | "incoming";
  }>;
  nextCursor: string | null;
} {
  const entity = getWorldEntityPure(state, userId, entityId);
  if (!entity) return { neighbors: [], nextCursor: null };

  const dir = filters.direction ?? "both";
  const limit = Math.min(filters.limit ?? 30, 80);
  let rels = state.relationships.filter(
    (r) =>
      r.userId === userId &&
      r.status !== "DELETED" &&
      r.status !== "ARCHIVED" &&
      (r.sourceEntityId === entityId || r.targetEntityId === entityId)
  );

  if (filters.relationshipType) {
    const types = Array.isArray(filters.relationshipType)
      ? filters.relationshipType
      : [filters.relationshipType];
    rels = rels.filter((r) => types.includes(r.relationshipType));
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    rels = rels.filter((r) => statuses.includes(r.status));
  } else {
    rels = rels.filter(
      (r) =>
        VALID_RELATIONSHIP_STATUSES.includes(r.status) ||
        r.status === "PENDING_CONFIRMATION" ||
        r.status === "HYPOTHESIS"
    );
  }
  if (filters.context) {
    rels = rels.filter((r) => r.context === filters.context);
  }
  if (typeof filters.minConfidence === "number") {
    rels = rels.filter((r) => r.confidence >= filters.minConfidence!);
  }

  const out: Array<{
    entity: WorldEntity;
    relationship: WorldRelationship;
    direction: "outgoing" | "incoming";
  }> = [];

  for (const r of rels) {
    const outgoing = r.sourceEntityId === entityId;
    const incoming = r.targetEntityId === entityId;
    if (dir === "outgoing" && !outgoing) continue;
    if (dir === "incoming" && !incoming) continue;
    const otherId = outgoing ? r.targetEntityId : r.sourceEntityId;
    const other = getWorldEntityPure(state, userId, otherId);
    if (!other) continue;
    if (filters.entityType && other.entityType !== filters.entityType) continue;
    out.push({
      entity: other,
      relationship: r,
      direction: outgoing ? "outgoing" : "incoming",
    });
  }

  let start = 0;
  if (filters.cursor) {
    const idx = out.findIndex((n) => n.relationship.id === filters.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = out.slice(start, start + limit);
  const nextCursor =
    start + limit < out.length
      ? page[page.length - 1]?.relationship.id ?? null
      : null;
  return { neighbors: page, nextCursor };
}

export function getEntityRelationshipsPure(
  state: WorldModelState,
  userId: string,
  entityId: string
): WorldRelationship[] {
  return state.relationships.filter(
    (r) =>
      r.userId === userId &&
      r.status !== "DELETED" &&
      (r.sourceEntityId === entityId || r.targetEntityId === entityId)
  );
}

export function getRelationshipPure(
  state: WorldModelState,
  userId: string,
  id: string
): WorldRelationship | null {
  const r = state.relationships.find((x) => x.id === id && x.userId === userId);
  if (!r || r.status === "DELETED") return null;
  return r;
}

/** Short path BFS — max depth 2 default, absolute max 3. */
export function findPathPure(
  state: WorldModelState,
  userId: string,
  fromEntityId: string,
  toEntityId: string,
  options?: {
    maxDepth?: number;
    relationshipTypes?: string[];
    limit?: number;
  }
): WorldPath[] {
  const maxDepth = Math.min(options?.maxDepth ?? 2, 3);
  const limit = Math.min(options?.limit ?? 5, 10);
  const start = getWorldEntityPure(state, userId, fromEntityId);
  const goal = getWorldEntityPure(state, userId, toEntityId);
  if (!start || !goal) return [];
  if (fromEntityId === toEntityId) {
    return [
      {
        nodes: [start],
        edges: [],
        depth: 0,
        explanation: "Mesma entidade",
      },
    ];
  }

  type Frame = {
    nodeId: string;
    pathNodes: string[];
    pathEdges: string[];
    depth: number;
  };

  const queue: Frame[] = [
    { nodeId: fromEntityId, pathNodes: [fromEntityId], pathEdges: [], depth: 0 },
  ];
  const visited = new Set<string>([fromEntityId]);
  const results: WorldPath[] = [];

  while (queue.length && results.length < limit) {
    const cur = queue.shift()!;
    if (cur.depth >= maxDepth) continue;

    const neighbors = getEntityNeighborsPure(state, userId, cur.nodeId, {
      limit: 50,
      status: ["ACTIVE", "CONFIRMED"],
      relationshipType: options?.relationshipTypes as never,
    });

    for (const n of neighbors.neighbors) {
      if (visited.has(n.entity.id) && n.entity.id !== toEntityId) continue;
      const nextNodes = [...cur.pathNodes, n.entity.id];
      const nextEdges = [...cur.pathEdges, n.relationship.id];
      if (n.entity.id === toEntityId) {
        const nodes = nextNodes
          .map((id) => getWorldEntityPure(state, userId, id))
          .filter(Boolean) as WorldEntity[];
        const edges = nextEdges
          .map((id) => getRelationshipPure(state, userId, id))
          .filter(Boolean) as WorldRelationship[];
        results.push({
          nodes,
          edges,
          depth: cur.depth + 1,
          explanation: edges
            .map(
              (e, i) =>
                `${nodes[i]?.displayName} —[${e.relationshipType}]→ ${nodes[i + 1]?.displayName}`
            )
            .join(" · "),
        });
        if (results.length >= limit) break;
      } else {
        visited.add(n.entity.id);
        queue.push({
          nodeId: n.entity.id,
          pathNodes: nextNodes,
          pathEdges: nextEdges,
          depth: cur.depth + 1,
        });
      }
    }
  }
  return results;
}

export function explainEntityPure(
  state: WorldModelState,
  userId: string,
  entityId: string
): { ok: boolean; explanation: string | null; entity: WorldEntity | null } {
  const e = getWorldEntityPure(state, userId, entityId);
  if (!e) return { ok: false, explanation: null, entity: null };
  const lines = [
    `Entidade ${e.entityType}: ${e.displayName}`,
    `Status: ${e.status} · Confiança: ${e.confidence}% (${e.confidenceBand})`,
    `Origem: ${e.sourceType}`,
    e.sourceReference
      ? `Fonte oficial: ${e.sourceReference.entityType}:${e.sourceReference.entityId}`
      : "Sem sourceReference de domínio",
    `Contexto: ${e.context}`,
    `canonicalKey: ${e.canonicalKey}`,
    `Primeira observação: ${e.firstObservedAt}`,
    `Última observação: ${e.lastObservedAt}`,
    "Influência em execução: nenhuma (executionInfluence: none)",
  ];
  return { ok: true, explanation: lines.join("\n"), entity: e };
}

export function explainRelationshipPure(
  state: WorldModelState,
  userId: string,
  relationshipId: string
): {
  ok: boolean;
  explanation: string | null;
  relationship: WorldRelationship | null;
} {
  const r = getRelationshipPure(state, userId, relationshipId);
  if (!r) return { ok: false, explanation: null, relationship: null };
  const s = getWorldEntityPure(state, userId, r.sourceEntityId);
  const t = getWorldEntityPure(state, userId, r.targetEntityId);
  const inferred =
    r.status === "HYPOTHESIS" || r.sourceType === "system_observation";
  const lines = [
    `Relação ${r.relationshipType}: ${s?.displayName ?? "?"} → ${t?.displayName ?? "?"}`,
    `Status: ${r.status} · ${inferred ? "inferida" : "confirmada/explícita"}`,
    `Confiança relação: ${r.confidence}% · Projeção: ${r.projectionConfidence}%`,
    `Origem: ${r.sourceType}`,
    r.sourceReference
      ? `Referência: ${r.sourceReference.entityType}:${r.sourceReference.entityId}`
      : "Sem sourceReference",
    `Evidências: ${r.evidence.length}`,
    r.evidence.map((e) => `- ${e.summary}`).join("\n"),
    "Influência em execução: nenhuma (executionInfluence: none)",
  ];
  return { ok: true, explanation: lines.join("\n"), relationship: r };
}

export function getRelationshipTimelinePure(
  state: WorldModelState,
  userId: string,
  entityId?: string
): Array<{ relationship: WorldRelationship; explanation: string }> {
  let rels = state.relationships.filter(
    (r) => r.userId === userId && r.status !== "DELETED"
  );
  if (entityId) {
    rels = rels.filter(
      (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
    );
  }
  rels.sort(
    (a, b) => Date.parse(b.firstObservedAt) - Date.parse(a.firstObservedAt)
  );
  return rels.slice(0, 60).map((relationship) => ({
    relationship,
    explanation:
      explainRelationshipPure(state, userId, relationship.id).explanation ?? "",
  }));
}

export function confirmRelationshipPure(
  state: WorldModelState,
  userId: string,
  relationshipId: string,
  reason?: string
): EngineResult<WorldRelationship> {
  const r = getRelationshipPure(state, userId, relationshipId);
  if (!r) return { ok: false, error: "Relação não encontrada", state, data: null };
  const at = new Date().toISOString();
  const updated: WorldRelationship = {
    ...r,
    status: "CONFIRMED",
    confidence: clampScore(Math.max(r.confidence, 90)),
    confidenceBand: "HIGH",
    updatedAt: at,
    lastObservedAt: at,
  };
  let next: WorldModelState = {
    ...state,
    relationships: state.relationships.map((x) =>
      x.id === relationshipId ? updated : x
    ),
  };
  next = audit(next, {
    userId,
    workspaceId: r.workspaceId,
    entityId: null,
    relationshipId,
    action: "relationship_confirmed",
    previousState: snapR(r),
    nextState: snapR(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Confirmada pelo usuário",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function rejectRelationshipPure(
  state: WorldModelState,
  userId: string,
  relationshipId: string,
  reason: string
): EngineResult<WorldRelationship> {
  const r = getRelationshipPure(state, userId, relationshipId);
  if (!r) return { ok: false, error: "Relação não encontrada", state, data: null };
  if (!reason?.trim()) {
    return { ok: false, error: "Motivo obrigatório", state, data: null };
  }
  const at = new Date().toISOString();
  const updated: WorldRelationship = {
    ...r,
    status: "REJECTED",
    confidence: 0,
    confidenceBand: "LOW",
    weight: 0,
    updatedAt: at,
  };
  const suppression: WorldSuppression = {
    id: uid("wsup"),
    userId,
    workspaceId: r.workspaceId,
    kind: "relationship",
    sourceType: r.sourceType,
    sourceReference: r.sourceReference ?? {
      entityType: "relationship",
      entityId: r.id,
    },
    relationshipType: r.relationshipType,
    reason,
    createdAt: at,
  };
  let next: WorldModelState = {
    ...state,
    relationships: state.relationships.map((x) =>
      x.id === relationshipId ? updated : x
    ),
    suppressions: [suppression, ...state.suppressions],
  };
  next = audit(next, {
    userId,
    workspaceId: r.workspaceId,
    entityId: null,
    relationshipId,
    action: "relationship_rejected",
    previousState: snapR(r),
    nextState: snapR(updated),
    sourceType: "user_explicit",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function correctRelationshipPure(
  state: WorldModelState,
  userId: string,
  input: {
    relationshipId: string;
    relationshipType?: string;
    reason: string;
  }
): EngineResult<WorldRelationship> {
  const old = getRelationshipPure(state, userId, input.relationshipId);
  if (!old) return { ok: false, error: "Relação não encontrada", state, data: null };
  if (!input.reason?.trim()) {
    return { ok: false, error: "Motivo obrigatório", state, data: null };
  }
  const at = new Date().toISOString();
  const superseded: WorldRelationship = {
    ...old,
    status: "SUPERSEDED",
    updatedAt: at,
  };
  const created = createWorldRelationshipPure(
    {
      ...state,
      relationships: state.relationships.map((r) =>
        r.id === old.id ? superseded : r
      ),
    },
    userId,
    {
      sourceEntityId: old.sourceEntityId,
      targetEntityId: old.targetEntityId,
      relationshipType: (input.relationshipType as never) ?? old.relationshipType,
      sourceType: "user_explicit",
      sourceReference: {
        entityType: "relationship_correction",
        entityId: old.id,
      },
      confirmNow: true,
      context: old.context,
      workspaceId: old.workspaceId,
      evidenceSummary: `Correção: ${input.reason}`,
    }
  );
  if (!created.ok || !created.data) {
    return { ok: false, error: created.error, state, data: null };
  }
  const replacement: WorldRelationship = {
    ...created.data,
    supersedesRelationshipId: old.id,
  };
  const memories = created.state.relationships.map((r) => {
    if (r.id === old.id) {
      return { ...superseded, supersededByRelationshipId: replacement.id };
    }
    if (r.id === replacement.id) return replacement;
    return r;
  });
  let next: WorldModelState = { ...created.state, relationships: memories };
  next = audit(next, {
    userId,
    workspaceId: old.workspaceId,
    entityId: null,
    relationshipId: replacement.id,
    action: "relationship_corrected",
    previousState: snapR(old),
    nextState: snapR(replacement),
    sourceType: "user_explicit",
    reason: input.reason,
    correlationId: null,
  });
  next = audit(next, {
    userId,
    workspaceId: old.workspaceId,
    entityId: null,
    relationshipId: old.id,
    action: "relationship_superseded",
    previousState: snapR(old),
    nextState: snapR({ ...superseded, supersededByRelationshipId: replacement.id }),
    sourceType: "user_explicit",
    reason: "Supersessão por correção humana",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: replacement };
}

export function archiveEntityPure(
  state: WorldModelState,
  userId: string,
  entityId: string,
  reason?: string
): EngineResult<WorldEntity> {
  const e = getWorldEntityPure(state, userId, entityId);
  if (!e) return { ok: false, error: "Entidade não encontrada", state, data: null };
  const at = new Date().toISOString();
  const updated: WorldEntity = {
    ...e,
    status: "ARCHIVED",
    archivedAt: at,
    updatedAt: at,
  };
  // Archive active relationships
  const relationships = state.relationships.map((r) => {
    if (
      r.userId === userId &&
      (r.sourceEntityId === entityId || r.targetEntityId === entityId) &&
      VALID_RELATIONSHIP_STATUSES.includes(r.status)
    ) {
      return { ...r, status: "ARCHIVED" as const, archivedAt: at, updatedAt: at };
    }
    return r;
  });
  let next: WorldModelState = {
    ...state,
    entities: state.entities.map((x) => (x.id === entityId ? updated : x)),
    relationships,
  };
  next = audit(next, {
    userId,
    workspaceId: e.workspaceId,
    entityId,
    relationshipId: null,
    action: "entity_archived",
    previousState: snapE(e),
    nextState: snapE(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Arquivada",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function archiveRelationshipPure(
  state: WorldModelState,
  userId: string,
  relationshipId: string,
  reason?: string
): EngineResult<WorldRelationship> {
  const r = getRelationshipPure(state, userId, relationshipId);
  if (!r) return { ok: false, error: "Relação não encontrada", state, data: null };
  const at = new Date().toISOString();
  const updated: WorldRelationship = {
    ...r,
    status: "ARCHIVED",
    archivedAt: at,
    updatedAt: at,
  };
  let next: WorldModelState = {
    ...state,
    relationships: state.relationships.map((x) =>
      x.id === relationshipId ? updated : x
    ),
  };
  next = audit(next, {
    userId,
    workspaceId: r.workspaceId,
    entityId: null,
    relationshipId,
    action: "relationship_archived",
    previousState: snapR(r),
    nextState: snapR(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Arquivada",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function mergeEntitiesPure(
  state: WorldModelState,
  userId: string,
  sourceId: string,
  targetId: string,
  reason: string
): EngineResult<WorldEntity> {
  const source = getWorldEntityPure(state, userId, sourceId);
  const target = getWorldEntityPure(state, userId, targetId);
  if (!source || !target) {
    return { ok: false, error: "Entidades não encontradas", state, data: null };
  }
  if (source.entityType !== target.entityType) {
    return { ok: false, error: "Merge exige mesmo entityType", state, data: null };
  }
  if (!reason?.trim()) {
    return { ok: false, error: "Motivo obrigatório", state, data: null };
  }
  const at = new Date().toISOString();
  const merged: WorldEntity = {
    ...target,
    aliases: [
      ...new Set([
        ...target.aliases,
        source.displayName,
        ...source.aliases,
      ]),
    ],
    attributes: { ...source.attributes, ...target.attributes },
    lastObservedAt: at,
    updatedAt: at,
    metadata: {
      ...target.metadata,
      mergedFrom: [...((target.metadata.mergedFrom as string[]) ?? []), source.id],
    },
  };
  const archivedSource: WorldEntity = {
    ...source,
    status: "SUPERSEDED",
    mergedIntoId: target.id,
    updatedAt: at,
  };
  const relationships = state.relationships.map((r) => {
    if (r.userId !== userId) return r;
    let next = r;
    if (r.sourceEntityId === sourceId) {
      next = { ...next, sourceEntityId: targetId, updatedAt: at };
    }
    if (r.targetEntityId === sourceId) {
      next = { ...next, targetEntityId: targetId, updatedAt: at };
    }
    return next;
  });
  let next: WorldModelState = {
    ...state,
    entities: state.entities.map((e) => {
      if (e.id === targetId) return merged;
      if (e.id === sourceId) return archivedSource;
      return e;
    }),
    relationships,
  };
  next = audit(next, {
    userId,
    workspaceId: target.workspaceId,
    entityId: targetId,
    relationshipId: null,
    action: "entity_merged",
    previousState: { source: snapE(source), target: snapE(target) },
    nextState: snapE(merged),
    sourceType: "user_explicit",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: merged };
}

export function correctEntityProjectionPure(
  state: WorldModelState,
  userId: string,
  input: {
    entityId: string;
    displayName?: string;
    description?: string;
    reason: string;
  }
): EngineResult<WorldEntity> {
  const e = getWorldEntityPure(state, userId, input.entityId);
  if (!e) return { ok: false, error: "Entidade não encontrada", state, data: null };
  if (!input.reason?.trim()) {
    return { ok: false, error: "Motivo obrigatório", state, data: null };
  }
  const at = new Date().toISOString();
  const updated: WorldEntity = {
    ...e,
    displayName: input.displayName?.trim() || e.displayName,
    description: input.description ?? e.description,
    updatedAt: at,
    metadata: {
      ...e.metadata,
      lastCorrectionReason: input.reason,
      correctionAffects: "world_model_only",
    },
  };
  let next: WorldModelState = {
    ...state,
    entities: state.entities.map((x) => (x.id === e.id ? updated : x)),
  };
  next = audit(next, {
    userId,
    workspaceId: e.workspaceId,
    entityId: e.id,
    relationshipId: null,
    action: "entity_corrected",
    previousState: snapE(e),
    nextState: snapE(updated),
    sourceType: "user_explicit",
    reason: `${input.reason} (apenas World Model — fonte operacional intacta)`,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function getWorldContextForBrainPure(
  state: WorldModelState,
  userId: string,
  input?: { workspaceId?: string | null; limit?: number; context?: string }
): WorldBrainContext {
  const limit = Math.min(input?.limit ?? 8, 12);
  const entities = searchWorldEntitiesPure(state, userId, {
    workspaceId: input?.workspaceId,
    context: input?.context,
    minConfidence: 40,
    limit,
  }).items.filter(
    (e) =>
      e.status !== "REJECTED" &&
      e.status !== "DELETED" &&
      e.sensitivity !== "RESTRICTED"
  );

  const relationships = state.relationships
    .filter(
      (r) =>
        r.userId === userId &&
        VALID_RELATIONSHIP_STATUSES.includes(r.status) &&
        r.confidence >= 40 &&
        entities.some(
          (e) => e.id === r.sourceEntityId || e.id === r.targetEntityId
        )
    )
    .slice(0, limit);

  const shortPaths: WorldBrainContext["shortPaths"] = [];
  if (entities.length >= 2) {
    const paths = findPathPure(
      state,
      userId,
      entities[0].id,
      entities[1].id,
      { maxDepth: 2, limit: 2 }
    );
    for (const p of paths) {
      shortPaths.push({ summary: p.explanation, depth: p.depth });
    }
  }

  return {
    entities: entities.map((e) => ({
      id: e.id,
      entityType: e.entityType,
      displayName: e.displayName,
      status: e.status,
      confidence: e.confidence,
      sourceType: e.sourceType,
      context: e.context,
    })),
    relationships: relationships.map((r) => {
      const s = state.entities.find((e) => e.id === r.sourceEntityId);
      const t = state.entities.find((e) => e.id === r.targetEntityId);
      return {
        id: r.id,
        relationshipType: r.relationshipType,
        sourceName: s?.displayName ?? "?",
        targetName: t?.displayName ?? "?",
        status: r.status,
        confidence: r.confidence,
        inferred: r.status === "HYPOTHESIS",
      };
    }),
    shortPaths,
    meta: {
      generatedAt: new Date().toISOString(),
      entityCount: entities.length,
      relationshipCount: relationships.length,
    },
    executionInfluence: "none",
  };
}

export function reconcileEntityFromSourcePure(
  state: WorldModelState,
  userId: string,
  input: {
    sourceType: CreateWorldEntityInput["sourceType"];
    sourceReference: SourceReference;
    patch: Partial<CreateWorldEntityInput>;
    sourceDeleted?: boolean;
  }
): EngineResult<{ entity: WorldEntity | null; report: string }> {
  const candidates = findEntityCandidates(state.entities, {
    userId,
    workspaceId: input.patch.workspaceId,
    entityType: input.patch.entityType ?? "concept",
    sourceType: input.sourceType,
    sourceReference: input.sourceReference,
  });
  const entity = candidates[0] ?? null;
  if (input.sourceDeleted && entity) {
    const archived = archiveEntityPure(
      state,
      userId,
      entity.id,
      "Fonte operacional apagada"
    );
    return {
      ok: archived.ok,
      error: archived.error,
      state: archived.state,
      data: {
        entity: archived.data,
        report: archived.ok ? "archived" : archived.error ?? "fail",
      },
    };
  }
  if (!entity) {
    return {
      ok: true,
      error: null,
      state,
      data: { entity: null, report: "sem projeção existente" },
    };
  }
  if (entity.status === "REJECTED") {
    return {
      ok: true,
      error: null,
      state: audit(state, {
        userId,
        workspaceId: entity.workspaceId,
        entityId: entity.id,
        relationshipId: null,
        action: "projection_suppressed",
        previousState: snapE(entity),
        nextState: null,
        sourceType: input.sourceType,
        reason: "Reconciliação bloqueada — entidade rejeitada",
        correlationId: null,
      }),
      data: { entity, report: "suppressed" },
    };
  }
  const at = new Date().toISOString();
  const updated: WorldEntity = {
    ...entity,
    displayName: input.patch.displayName?.trim() || entity.displayName,
    description: input.patch.description ?? entity.description,
    attributes: {
      ...entity.attributes,
      ...filterAllowedAttributes(
        entity.entityType,
        input.patch.attributes ?? {}
      ),
    },
    lastObservedAt: at,
    updatedAt: at,
  };
  let next: WorldModelState = {
    ...state,
    entities: state.entities.map((e) => (e.id === entity.id ? updated : e)),
  };
  next = audit(next, {
    userId,
    workspaceId: entity.workspaceId,
    entityId: entity.id,
    relationshipId: null,
    action: "reconcile",
    previousState: snapE(entity),
    nextState: snapE(updated),
    sourceType: input.sourceType,
    reason: "Reconciliação com fonte",
    correlationId: null,
  });
  return {
    ok: true,
    error: null,
    state: next,
    data: { entity: updated, report: "updated" },
  };
}

export function emptyProjectionReport(dryRun: boolean): ProjectionReport {
  return {
    dryRun,
    items: [],
    created: 0,
    updated: 0,
    skipped: 0,
    suppressed: 0,
  };
}
