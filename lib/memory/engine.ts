/**
 * Pure Memory Engine operations — no DB, no auth.
 */

import {
  applyContradictionPenalty,
  clampScore,
  confidenceBand,
  initialImportance,
  initialMemoryConfidence,
  initialWeight,
  pushScoreHistory,
  reinforceConfidence,
} from "@/lib/memory/confidence";
import {
  experienceFingerprint,
  normalizeExperience,
  suggestMemoryTypeFromExperience,
  validateExperienceInput,
} from "@/lib/memory/experience";
import { assertMemoryPrivacy, defaultSensitivityFor } from "@/lib/memory/privacy";
import {
  evaluateMemoryForPromotionPure,
  type IdentityGateSnapshot,
} from "@/lib/memory/promotion";
import {
  computeValidUntil,
  defaultRetentionFor,
  isExpired,
} from "@/lib/memory/retention";
import type {
  CorrectMemoryInput,
  CreateMemoryInput,
  ExperienceRecord,
  MemoryAuditEvent,
  MemoryBrainContext,
  MemoryEvidence,
  MemoryFeedback,
  MemoryPromotionResult,
  MemoryRecord,
  MemorySearchFilters,
  MemoryStatus,
  MemoryTimelineEntry,
  RecordExperienceInput,
  SubmitMemoryFeedbackInput,
} from "@/lib/memory/types";
import { ACTIVE_MEMORY_STATUSES, BLOCKED_FROM_RECALL } from "@/lib/memory/types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export type MemoryEngineState = {
  experiences: ExperienceRecord[];
  memories: MemoryRecord[];
  feedbacks: MemoryFeedback[];
  audits: MemoryAuditEvent[];
  promotions: MemoryPromotionResult[];
};

export function createEmptyMemoryState(): MemoryEngineState {
  return {
    experiences: [],
    memories: [],
    feedbacks: [],
    audits: [],
    promotions: [],
  };
}

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  state: MemoryEngineState;
  data: T | null;
};

function audit(
  state: MemoryEngineState,
  event: Omit<MemoryAuditEvent, "id" | "createdAt"> & { createdAt?: string }
): MemoryEngineState {
  const entry: MemoryAuditEvent = {
    id: uid("maud"),
    createdAt: event.createdAt ?? new Date().toISOString(),
    ...event,
  };
  return { ...state, audits: [entry, ...state.audits].slice(0, 800) };
}

function snapshot(m: MemoryRecord): Record<string, unknown> {
  return {
    id: m.id,
    status: m.status,
    confidence: m.confidence,
    importance: m.importance,
    weight: m.weight,
    title: m.title,
    promotionStatus: m.promotionStatus,
    memoryType: m.memoryType,
  };
}

function buildFingerprint(input: {
  userId: string;
  workspaceId: string | null;
  memoryType: string;
  sourceType: string;
  sourceReference: { entityType: string; entityId: string } | null;
  semanticKey: string | null;
  title: string;
  occurredAtDay: string;
}): string {
  return experienceFingerprint({
    userId: input.userId,
    workspaceId: input.workspaceId,
    experienceType: input.memoryType,
    sourceType: input.sourceType as never,
    sourceReference: input.sourceReference,
    subjectType: null,
    subjectId: null,
    context: input.semanticKey ?? input.title,
    payload: { t: input.title },
    occurredAtDay: input.occurredAtDay,
  });
}

function findDuplicate(
  state: MemoryEngineState,
  userId: string,
  fingerprint: string,
  idempotencyKey: string | null,
  windowMs = 86_400_000
): MemoryRecord | null {
  const now = Date.now();
  for (const m of state.memories) {
    if (m.userId !== userId) continue;
    if (m.status === "DELETED") continue;
    if (idempotencyKey && m.idempotencyKey === idempotencyKey) return m;
    if (m.fingerprint === fingerprint) {
      const age = now - Date.parse(m.createdAt);
      if (!Number.isFinite(age) || age <= windowMs) return m;
    }
  }
  return null;
}

function findSemanticConflict(
  state: MemoryEngineState,
  userId: string,
  semanticKey: string | null,
  workspaceId: string | null,
  newValue: unknown
): MemoryRecord | null {
  if (!semanticKey) return null;
  return (
    state.memories.find((m) => {
      if (m.userId !== userId) return false;
      if (m.workspaceId !== workspaceId) return false;
      if (m.semanticKey !== semanticKey) return false;
      if (!ACTIVE_MEMORY_STATUSES.includes(m.status) && m.status !== "CONFIRMED") {
        return false;
      }
      if (m.structuredContent.kind !== "semantic") return false;
      return (
        JSON.stringify(m.structuredContent.factValue) !== JSON.stringify(newValue)
      );
    }) ?? null
  );
}

export function recordExperiencePure(
  state: MemoryEngineState,
  userId: string,
  input: RecordExperienceInput
): EngineResult<{ experience: ExperienceRecord; memory: MemoryRecord | null }> {
  const v = validateExperienceInput(input);
  if (!v.ok) return { ok: false, error: v.reason, state, data: null };

  const experience = normalizeExperience(userId, {
    ...input,
    workspaceId: input.workspaceId ?? null,
  });

  // Idempotency on experiences
  if (experience.idempotencyKey) {
    const existing = state.experiences.find(
      (e) =>
        e.userId === userId && e.idempotencyKey === experience.idempotencyKey
    );
    if (existing) {
      const linked =
        state.memories.find((m) => m.experienceId === existing.id) ?? null;
      return {
        ok: true,
        error: null,
        state,
        data: { experience: existing, memory: linked },
      };
    }
  }

  const sameFp = state.experiences.find(
    (e) => e.userId === userId && e.fingerprint === experience.fingerprint
  );
  if (sameFp) {
    const linked =
      state.memories.find((m) => m.experienceId === sameFp.id) ?? null;
    return {
      ok: true,
      error: null,
      state,
      data: { experience: sameFp, memory: linked },
    };
  }

  let next: MemoryEngineState = {
    ...state,
    experiences: [experience, ...state.experiences].slice(0, 2000),
  };
  next = audit(next, {
    userId,
    workspaceId: experience.workspaceId,
    memoryId: null,
    experienceId: experience.id,
    action: "experience_recorded",
    previousState: null,
    nextState: {
      id: experience.id,
      experienceType: experience.experienceType,
      sourceType: experience.sourceType,
    },
    sourceType: experience.sourceType,
    reason: "Experiência registrada (sem julgamento de verdade)",
    correlationId: experience.correlationId,
  });

  let memory: MemoryRecord | null = null;
  if (input.materializeMemory !== false) {
    const hint = input.memoryHint;
    const memoryType =
      hint?.memoryType ?? suggestMemoryTypeFromExperience(experience.experienceType);
    const title =
      hint?.title ??
      String(experience.payload.title ?? experience.experienceType.replace(/_/g, " "));
    const content =
      hint?.content ??
      String(experience.payload.content ?? experience.payload.summary ?? title);

    const structured =
      hint?.structuredContent ??
      (memoryType === "SEMANTIC"
        ? {
            kind: "semantic" as const,
            factKey: String(experience.payload.factKey ?? experience.experienceType),
            factValue: experience.payload.factValue ?? experience.payload.value ?? content,
            contextScope: experience.context,
            summary: content,
          }
        : memoryType === "PROCEDURAL"
          ? {
              kind: "procedural" as const,
              processKey: String(experience.payload.processKey ?? "process"),
              version: 1,
              steps: Array.isArray(experience.payload.steps)
                ? (experience.payload.steps as Array<{ order: number; instruction: string }>)
                : [{ order: 1, instruction: content }],
              validationStatus: "observed_once" as const,
              summary: content,
            }
          : memoryType === "REFLECTIVE"
            ? {
                kind: "reflective" as const,
                derivationMethod: String(experience.payload.method ?? "pattern"),
                timeWindow: {
                  from: experience.occurredAt,
                  to: experience.occurredAt,
                },
                baseMemoryIds: [],
                patternSummary: content,
                summary: content,
              }
            : {
                kind: "episodic" as const,
                when: experience.occurredAt,
                where: experience.context,
                participants: experience.subjectType
                  ? [
                      {
                        subjectType: experience.subjectType,
                        subjectId: experience.subjectId ?? "unknown",
                      },
                    ]
                  : [],
                correlationId: experience.correlationId,
                summary: content,
              });

    const created = createMemoryPure(next, userId, {
      memoryType,
      title,
      content,
      structuredContent: structured,
      sourceType: experience.sourceType,
      sourceReference: experience.sourceReference,
      context: experience.context,
      subjects: experience.subjectType
        ? [
            {
              subjectType: experience.subjectType,
              subjectId: experience.subjectId ?? "unknown",
            },
          ]
        : [],
      sensitivity: experience.sensitivity,
      consentScope: experience.consentScope,
      workspaceId: experience.workspaceId,
      experienceId: experience.id,
      idempotencyKey: experience.idempotencyKey,
      occurredAt: experience.occurredAt,
      semanticKey:
        structured.kind === "semantic" ? structured.factKey : hint?.semanticKey,
      confirmNow: hint?.confirmNow,
      importance: hint?.importance,
      confidence: hint?.confidence,
      metadata: { ...(hint?.metadata ?? {}), experienceType: experience.experienceType },
      evidenceSummary: `Origem: ${experience.experienceType}`,
    });
    if (created.ok && created.data) {
      next = created.state;
      memory = created.data;
    } else if (!created.ok) {
      return { ok: false, error: created.error, state: next, data: null };
    }
  }

  return {
    ok: true,
    error: null,
    state: next,
    data: { experience, memory },
  };
}

export function createMemoryPure(
  state: MemoryEngineState,
  userId: string,
  input: CreateMemoryInput
): EngineResult<MemoryRecord> {
  if (!input.title?.trim() || !input.content?.trim()) {
    return { ok: false, error: "title e content obrigatórios", state, data: null };
  }
  if (!input.structuredContent?.kind) {
    return { ok: false, error: "structuredContent tipado obrigatório", state, data: null };
  }

  const privacy = assertMemoryPrivacy({
    title: input.title,
    content: input.content,
    semanticKey: input.semanticKey,
    sourceType: input.sourceType,
    sensitivity: input.sensitivity,
  });
  if (!privacy.ok) {
    return { ok: false, error: privacy.reason, state, data: null };
  }

  const at = new Date().toISOString();
  const occurredAt = input.occurredAt ?? at;
  const workspaceId = input.workspaceId ?? null;
  const semanticKey =
    input.semanticKey ??
    (input.structuredContent.kind === "semantic"
      ? input.structuredContent.factKey
      : null);

  const fingerprint = buildFingerprint({
    userId,
    workspaceId,
    memoryType: input.memoryType,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    semanticKey,
    title: input.title,
    occurredAtDay: occurredAt.slice(0, 10),
  });

  const dup = findDuplicate(state, userId, fingerprint, input.idempotencyKey ?? null);
  if (dup) {
    // Merge evidence without inflating confidence from identical event
    const evidence: MemoryEvidence = {
      id: uid("evid"),
      observedAt: at,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
      summary: input.evidenceSummary ?? "evento duplicado (idempotente)",
      strength: 5,
    };
    const merged: MemoryRecord = {
      ...dup,
      evidence: [...dup.evidence, evidence].slice(0, 40),
      updatedAt: at,
      // Identical events must NOT inflate confidence/weight
      duplicateOfMemoryId: null,
    };
    const memories = state.memories.map((m) => (m.id === dup.id ? merged : m));
    let next: MemoryEngineState = { ...state, memories };
    next = audit(next, {
      userId,
      workspaceId,
      memoryId: dup.id,
      experienceId: input.experienceId ?? null,
      action: "dedupe",
      previousState: snapshot(dup),
      nextState: snapshot(merged),
      sourceType: input.sourceType,
      reason: "Idempotência/dedupe — evidência anexada sem inflar confidence",
      correlationId: null,
    });
    return { ok: true, error: null, state: next, data: merged };
  }

  const confidence = initialMemoryConfidence({
    sourceType: input.sourceType,
    confirmNow: input.confirmNow,
    explicitConfidence: input.confidence,
  });
  const importance = initialImportance({
    memoryType: input.memoryType,
    sourceType: input.sourceType,
    explicit: input.importance,
  });
  const weight = initialWeight({
    confidence,
    importance,
    statusBoost: input.confirmNow ? 10 : 0,
  });

  const sensitivity =
    privacy.forceSensitivity ??
    input.sensitivity ??
    defaultSensitivityFor({
      title: input.title,
      content: input.content,
      sourceType: input.sourceType,
      context: input.context,
    });

  const retentionPolicy =
    input.retentionPolicy ??
    defaultRetentionFor({
      memoryType: input.memoryType,
      sensitivity,
      confirmed: Boolean(input.confirmNow),
      sourceType: input.sourceType,
    });

  const status: MemoryStatus = input.confirmNow
    ? "CONFIRMED"
    : input.memoryType === "REFLECTIVE"
      ? "PENDING_REVIEW"
      : "ACTIVE";

  const evidence: MemoryEvidence[] = [
    {
      id: uid("evid"),
      observedAt: at,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
      summary: input.evidenceSummary ?? "criação de memória",
      strength: input.confirmNow ? 90 : 40,
    },
  ];

  let memory: MemoryRecord = {
    id: uid("mem"),
    userId,
    workspaceId,
    memoryType: input.memoryType,
    status,
    title: input.title.trim(),
    content: input.content.trim(),
    structuredContent: input.structuredContent,
    sourceType: input.sourceType,
    sourceReference: input.sourceReference ?? null,
    evidence,
    context: input.context?.trim() || "general",
    subjects: input.subjects ?? [],
    importance,
    confidence,
    confidenceBand: confidenceBand(confidence),
    weight,
    sensitivity,
    retentionPolicy,
    validFrom: input.validFrom ?? occurredAt,
    validUntil:
      input.validUntil ??
      computeValidUntil(retentionPolicy, occurredAt, input.validUntil),
    occurredAt,
    lastRecalledAt: null,
    recallCount: 0,
    supersedesMemoryId: null,
    supersededByMemoryId: null,
    duplicateOfMemoryId: null,
    promotionStatus: "NONE",
    experienceId: input.experienceId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    fingerprint,
    semanticKey,
    scoreHistory: [
      ...pushScoreHistory([], "confidence", 0, confidence, "criação", "system", at),
      ...pushScoreHistory([], "importance", 0, importance, "criação", "system", at),
      ...pushScoreHistory([], "weight", 0, weight, "criação", "system", at),
    ],
    consentScope: input.consentScope ?? "personal",
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    deletedAt: null,
    metadata: input.metadata ?? {},
  };

  // Conflict detection for semantic keys
  const conflict = findSemanticConflict(
    state,
    userId,
    semanticKey,
    workspaceId,
    input.structuredContent.kind === "semantic"
      ? input.structuredContent.factValue
      : null
  );

  let next: MemoryEngineState = {
    ...state,
    memories: [memory, ...state.memories],
  };

  if (conflict) {
    const penalizedConf = applyContradictionPenalty(memory.confidence);
    memory = {
      ...memory,
      status: "DISPUTED",
      confidence: penalizedConf,
      confidenceBand: confidenceBand(penalizedConf),
      weight: initialWeight({ confidence: penalizedConf, importance }),
      scoreHistory: pushScoreHistory(
        memory.scoreHistory,
        "confidence",
        memory.confidence,
        penalizedConf,
        "contradição semântica detectada",
        "system",
        at
      ),
      metadata: {
        ...memory.metadata,
        conflictWithMemoryId: conflict.id,
      },
    };
    const conflictUpdated: MemoryRecord = {
      ...conflict,
      status: "DISPUTED",
      updatedAt: at,
      metadata: {
        ...conflict.metadata,
        conflictWithMemoryId: memory.id,
      },
    };
    next = {
      ...next,
      memories: next.memories.map((m) => {
        if (m.id === memory.id) return memory;
        if (m.id === conflict.id) return conflictUpdated;
        return m;
      }),
    };
  }

  next = audit(next, {
    userId,
    workspaceId,
    memoryId: memory.id,
    experienceId: input.experienceId ?? null,
    action: "create",
    previousState: null,
    nextState: snapshot(memory),
    sourceType: input.sourceType,
    reason: conflict
      ? "Memória criada em disputa (contradição)"
      : "Memória criada",
    correlationId: null,
  });

  return { ok: true, error: null, state: next, data: memory };
}

export function getMemoryPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string
): MemoryRecord | null {
  const m = state.memories.find((x) => x.id === memoryId && x.userId === userId);
  if (!m || m.status === "DELETED") return null;
  return m;
}

export function listMemoriesPure(
  state: MemoryEngineState,
  userId: string,
  filters?: MemorySearchFilters
): MemoryRecord[] {
  return searchMemoriesPure(state, userId, filters).items;
}

export function searchMemoriesPure(
  state: MemoryEngineState,
  userId: string,
  filters: MemorySearchFilters = {}
): { items: MemoryRecord[]; nextCursor: string | null } {
  const limit = Math.min(filters.limit ?? 40, 100);
  let items = state.memories.filter((m) => m.userId === userId);

  if (filters.workspaceId !== undefined) {
    items = items.filter((m) => m.workspaceId === filters.workspaceId);
  }
  if (!filters.includeDeleted) {
    items = items.filter((m) => m.status !== "DELETED" && !m.deletedAt);
  }
  if (!filters.includeArchived) {
    items = items.filter((m) => m.status !== "ARCHIVED");
  }
  if (filters.memoryType) {
    const types = Array.isArray(filters.memoryType)
      ? filters.memoryType
      : [filters.memoryType];
    items = items.filter((m) => types.includes(m.memoryType));
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : [filters.status];
    items = items.filter((m) => statuses.includes(m.status));
  }
  if (filters.context) {
    items = items.filter((m) => m.context === filters.context);
  }
  if (filters.sourceType) {
    items = items.filter((m) => m.sourceType === filters.sourceType);
  }
  if (filters.subjectType) {
    items = items.filter((m) =>
      m.subjects.some((s) => s.subjectType === filters.subjectType)
    );
  }
  if (filters.subjectId) {
    items = items.filter((m) =>
      m.subjects.some((s) => s.subjectId === filters.subjectId)
    );
  }
  if (filters.from) {
    const t = Date.parse(filters.from);
    items = items.filter((m) => Date.parse(m.occurredAt) >= t);
  }
  if (filters.to) {
    const t = Date.parse(filters.to);
    items = items.filter((m) => Date.parse(m.occurredAt) <= t);
  }
  if (typeof filters.minConfidence === "number") {
    items = items.filter((m) => m.confidence >= filters.minConfidence!);
  }
  if (typeof filters.minImportance === "number") {
    items = items.filter((m) => m.importance >= filters.minImportance!);
  }
  if (filters.promotionStatus) {
    items = items.filter((m) => m.promotionStatus === filters.promotionStatus);
  }
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    items = items.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.context.toLowerCase().includes(q)
    );
  }

  // Contextual sort: weight desc, then occurredAt desc
  items.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  });

  let start = 0;
  if (filters.cursor) {
    const idx = items.findIndex((m) => m.id === filters.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = items.slice(start, start + limit);
  const nextCursor =
    start + limit < items.length ? page[page.length - 1]?.id ?? null : null;
  return { items: page, nextCursor };
}

export function getContextualMemoriesPure(
  state: MemoryEngineState,
  userId: string,
  input: {
    context?: string;
    workspaceId?: string | null;
    limit?: number;
    markRecall?: boolean;
  }
): EngineResult<MemoryRecord[]> {
  const limit = Math.min(input.limit ?? 8, 20);
  const { items } = searchMemoriesPure(state, userId, {
    workspaceId: input.workspaceId,
    context: input.context,
    limit: 80,
  });

  const eligible = items.filter(
    (m) =>
      !BLOCKED_FROM_RECALL.includes(m.status) &&
      !isExpired(m) &&
      m.duplicateOfMemoryId == null
  );

  const selected = eligible
    .sort((a, b) => b.weight * b.confidence - a.weight * a.confidence)
    .slice(0, limit);

  if (!input.markRecall) {
    return { ok: true, error: null, state, data: selected };
  }

  const at = new Date().toISOString();
  const ids = new Set(selected.map((m) => m.id));
  const memories = state.memories.map((m) => {
    if (!ids.has(m.id)) return m;
    return {
      ...m,
      lastRecalledAt: at,
      recallCount: m.recallCount + 1,
      updatedAt: at,
    };
  });
  let next: MemoryEngineState = { ...state, memories };
  for (const m of selected) {
    next = audit(next, {
      userId,
      workspaceId: m.workspaceId,
      memoryId: m.id,
      experienceId: m.experienceId,
      action: "recall",
      previousState: { recallCount: m.recallCount },
      nextState: { recallCount: m.recallCount + 1, lastRecalledAt: at },
      sourceType: m.sourceType,
      reason: "Recall contextual auditável (sem promoção)",
      correlationId: null,
    });
  }
  return {
    ok: true,
    error: null,
    state: next,
    data: memories.filter((m) => ids.has(m.id)),
  };
}

export function getMemoriesBySubjectPure(
  state: MemoryEngineState,
  userId: string,
  subjectType: string,
  subjectId: string
): MemoryRecord[] {
  return searchMemoriesPure(state, userId, { subjectType, subjectId, limit: 50 })
    .items;
}

export function getMemoryTimelinePure(
  state: MemoryEngineState,
  userId: string,
  filters?: MemorySearchFilters
): MemoryTimelineEntry[] {
  const items = searchMemoriesPure(state, userId, {
    ...filters,
    limit: filters?.limit ?? 60,
  }).items;
  return items.map((memory) => ({
    memory,
    explanation: explainMemoryText(memory),
    relatedIds: [
      memory.supersedesMemoryId,
      memory.supersededByMemoryId,
      memory.duplicateOfMemoryId,
      typeof memory.metadata.conflictWithMemoryId === "string"
        ? memory.metadata.conflictWithMemoryId
        : null,
    ].filter(Boolean) as string[],
  }));
}

export function explainMemoryText(memory: MemoryRecord): string {
  const lines = [
    `Memória ${memory.memoryType} · status ${memory.status}`,
    `Título: ${memory.title}`,
    `Conteúdo: ${memory.content}`,
    `Origem: ${memory.sourceType}${
      memory.sourceReference
        ? ` (${memory.sourceReference.entityType}:${memory.sourceReference.entityId})`
        : ""
    }`,
    `Contexto: ${memory.context}`,
    `Confiança: ${memory.confidence}% (${memory.confidenceBand}) · Importância: ${memory.importance} · Peso: ${memory.weight}`,
    `Retenção: ${memory.retentionPolicy}${
      memory.validUntil ? ` até ${memory.validUntil.slice(0, 10)}` : ""
    }`,
    `Evidências: ${memory.evidence.length}`,
    `Promoção: ${memory.promotionStatus}`,
    memory.promotionStatus !== "NONE"
      ? "Esta memória foi avaliada para Identity (sem execução)."
      : "Ainda não influenciou Identity.",
  ];
  return lines.join("\n");
}

export function explainMemoryPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string
): { ok: boolean; explanation: string | null; memory: MemoryRecord | null } {
  const memory = getMemoryPure(state, userId, memoryId);
  if (!memory) return { ok: false, explanation: null, memory: null };
  return { ok: true, explanation: explainMemoryText(memory), memory };
}

export function correctMemoryPure(
  state: MemoryEngineState,
  userId: string,
  input: CorrectMemoryInput
): EngineResult<MemoryRecord> {
  const old = getMemoryPure(state, userId, input.memoryId);
  if (!old) return { ok: false, error: "Memória não encontrada", state, data: null };
  if (!input.reason?.trim()) {
    return { ok: false, error: "Motivo obrigatório", state, data: null };
  }

  const at = new Date().toISOString();
  const correctedOld: MemoryRecord = {
    ...old,
    status: "CORRECTED",
    updatedAt: at,
    weight: 0,
    scoreHistory: pushScoreHistory(
      old.scoreHistory,
      "weight",
      old.weight,
      0,
      `corrigida: ${input.reason}`,
      "user",
      at
    ),
  };

  const newContent = input.content ?? old.content;
  const newTitle = input.title ?? old.title;
  const structured = input.structuredContent ?? old.structuredContent;

  const created = createMemoryPure(
    { ...state, memories: state.memories.map((m) => (m.id === old.id ? correctedOld : m)) },
    userId,
    {
      memoryType: old.memoryType,
      title: newTitle,
      content: newContent,
      structuredContent: structured,
      sourceType: "user_explicit",
      sourceReference: {
        entityType: "memory_correction",
        entityId: old.id,
      },
      context: old.context,
      subjects: old.subjects,
      sensitivity: old.sensitivity,
      retentionPolicy: "user_managed",
      confirmNow: true,
      semanticKey: old.semanticKey,
      workspaceId: old.workspaceId,
      evidenceSummary: `Correção humana: ${input.reason}`,
      metadata: {
        correctsMemoryId: old.id,
        correctionReason: input.reason,
      },
    }
  );
  if (!created.ok || !created.data) {
    return { ok: false, error: created.error, state, data: null };
  }

  const replacement: MemoryRecord = {
    ...created.data,
    supersedesMemoryId: old.id,
  };
  const memories = created.state.memories.map((m) => {
    if (m.id === old.id) {
      return { ...correctedOld, supersededByMemoryId: replacement.id };
    }
    if (m.id === replacement.id) return replacement;
    return m;
  });

  let next: MemoryEngineState = { ...created.state, memories };
  next = audit(next, {
    userId,
    workspaceId: old.workspaceId,
    memoryId: replacement.id,
    experienceId: null,
    action: "correct",
    previousState: snapshot(old),
    nextState: snapshot(replacement),
    sourceType: "user_explicit",
    reason: input.reason,
    correlationId: null,
  });
  next = audit(next, {
    userId,
    workspaceId: old.workspaceId,
    memoryId: old.id,
    experienceId: null,
    action: "supersede",
    previousState: snapshot(old),
    nextState: snapshot({ ...correctedOld, supersededByMemoryId: replacement.id }),
    sourceType: "user_explicit",
    reason: "Versão antiga marcada CORRECTED/SUPERSEDED",
    correlationId: null,
  });

  return { ok: true, error: null, state: next, data: replacement };
}

export function disputeMemoryPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  reason: string
): EngineResult<MemoryRecord> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const at = new Date().toISOString();
  const updated: MemoryRecord = {
    ...m,
    status: "DISPUTED",
    updatedAt: at,
    weight: Math.min(m.weight, 20),
    scoreHistory: pushScoreHistory(
      m.scoreHistory,
      "weight",
      m.weight,
      Math.min(m.weight, 20),
      reason,
      "user",
      at
    ),
  };
  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId,
    experienceId: m.experienceId,
    action: "dispute",
    previousState: snapshot(m),
    nextState: snapshot(updated),
    sourceType: "user_feedback",
    reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function archiveMemoryPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  reason?: string
): EngineResult<MemoryRecord> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const at = new Date().toISOString();
  const updated: MemoryRecord = {
    ...m,
    status: "ARCHIVED",
    archivedAt: at,
    updatedAt: at,
    weight: 0,
  };
  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId,
    experienceId: m.experienceId,
    action: "archive",
    previousState: snapshot(m),
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Arquivada pelo usuário",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function deleteMemoryPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  reason?: string,
  hard = false
): EngineResult<{ memoryId: string }> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const at = new Date().toISOString();

  if (hard) {
    const memories = state.memories.filter((x) => x.id !== memoryId);
    let next: MemoryEngineState = { ...state, memories };
    next = audit(next, {
      userId,
      workspaceId: m.workspaceId,
      memoryId,
      experienceId: m.experienceId,
      action: "delete",
      previousState: snapshot(m),
      nextState: null,
      sourceType: "user_explicit",
      reason: reason ?? "Exclusão definitiva",
      correlationId: null,
    });
    return { ok: true, error: null, state: next, data: { memoryId } };
  }

  const updated: MemoryRecord = {
    ...m,
    status: "DELETED",
    deletedAt: at,
    updatedAt: at,
    weight: 0,
    metadata: { ...m.metadata, hardDeleteEligible: true },
  };
  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId,
    experienceId: m.experienceId,
    action: "forget",
    previousState: snapshot(m),
    nextState: snapshot(updated),
    sourceType: "user_explicit",
    reason: reason ?? "Esquecimento solicitado",
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: { memoryId } };
}

export function submitMemoryFeedbackPure(
  state: MemoryEngineState,
  userId: string,
  input: SubmitMemoryFeedbackInput
): EngineResult<{ memory: MemoryRecord; feedback: MemoryFeedback }> {
  const m = getMemoryPure(state, userId, input.memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };

  const at = new Date().toISOString();
  const feedback: MemoryFeedback = {
    id: uid("mfb"),
    userId,
    memoryId: m.id,
    kind: input.kind,
    note: input.note ?? null,
    correctionContent: input.correctionContent ?? null,
    createdAt: at,
  };

  let updated = m;
  switch (input.kind) {
    case "accurate":
    case "useful":
      updated = {
        ...m,
        status: m.status === "ACTIVE" ? "CONFIRMED" : m.status,
        confidence: clampScore(Math.max(m.confidence, 85)),
        confidenceBand: confidenceBand(Math.max(m.confidence, 85)),
        weight: clampScore(m.weight + 10),
        updatedAt: at,
      };
      break;
    case "inaccurate":
      updated = {
        ...m,
        status: "REJECTED",
        confidence: 0,
        confidenceBand: "LOW",
        weight: 0,
        updatedAt: at,
      };
      break;
    case "outdated":
      updated = {
        ...m,
        status: "OUTDATED",
        weight: Math.min(m.weight, 15),
        updatedAt: at,
      };
      break;
    case "irrelevant":
      updated = {
        ...m,
        weight: 0,
        status: "ARCHIVED",
        archivedAt: at,
        updatedAt: at,
      };
      break;
    case "sensitive":
      updated = {
        ...m,
        sensitivity: "SENSITIVE",
        promotionStatus: "BLOCKED",
        updatedAt: at,
      };
      break;
    case "forget": {
      const del = deleteMemoryPure(state, userId, m.id, input.note ?? "forget");
      if (!del.ok) return { ok: false, error: del.error, state, data: null };
      const mem =
        del.state.memories.find((x) => x.id === m.id) ??
        ({ ...m, status: "DELETED" as const, deletedAt: at } satisfies MemoryRecord);
      return {
        ok: true,
        error: null,
        state: {
          ...del.state,
          feedbacks: [feedback, ...del.state.feedbacks].slice(0, 500),
        },
        data: { memory: mem, feedback },
      };
    }
    case "correct": {
      const corr = correctMemoryPure(state, userId, {
        memoryId: m.id,
        content: input.correctionContent ?? m.content,
        reason: input.note ?? "correção via feedback",
      });
      if (!corr.ok || !corr.data) {
        return { ok: false, error: corr.error, state, data: null };
      }
      const nextFb: MemoryEngineState = {
        ...corr.state,
        feedbacks: [feedback, ...corr.state.feedbacks].slice(0, 500),
      };
      return {
        ok: true,
        error: null,
        state: audit(nextFb, {
          userId,
          workspaceId: m.workspaceId,
          memoryId: corr.data.id,
          experienceId: null,
          action: "feedback",
          previousState: snapshot(m),
          nextState: snapshot(corr.data),
          sourceType: "user_feedback",
          reason: "feedback:correct",
          correlationId: null,
        }),
        data: { memory: corr.data, feedback },
      };
    }
  }

  updated = {
    ...updated,
    confidenceBand: confidenceBand(updated.confidence),
    scoreHistory: pushScoreHistory(
      m.scoreHistory,
      "weight",
      m.weight,
      updated.weight,
      `feedback:${input.kind}`,
      "user",
      at
    ),
  };

  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === m.id ? updated : x)),
    feedbacks: [feedback, ...state.feedbacks].slice(0, 500),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId: m.id,
    experienceId: m.experienceId,
    action: "feedback",
    previousState: snapshot(m),
    nextState: snapshot(updated),
    sourceType: "user_feedback",
    reason: `feedback:${input.kind}${input.note ? ` — ${input.note}` : ""}`,
    correlationId: null,
  });

  return { ok: true, error: null, state: next, data: { memory: updated, feedback } };
}

export function evaluateMemoryForPromotion(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  identity?: IdentityGateSnapshot
): EngineResult<MemoryPromotionResult> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const result = evaluateMemoryForPromotionPure(m, identity);
  const updated: MemoryRecord = {
    ...m,
    promotionStatus:
      result.decision === "NO_PROMOTION"
        ? result.gates.some((g) => !g.passed && g.name === "sensitivity")
          ? "BLOCKED"
          : "EVALUATED"
        : result.decision === "QUEUE_FOR_REVIEW"
          ? "QUEUED_FOR_REVIEW"
          : result.decision === "FUTURE_GRAPH_CANDIDATE"
            ? "FUTURE_GRAPH_CANDIDATE"
            : m.promotionStatus,
    updatedAt: new Date().toISOString(),
  };
  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
    promotions: [result, ...state.promotions].slice(0, 200),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId,
    experienceId: m.experienceId,
    action: "promote_evaluate",
    previousState: snapshot(m),
    nextState: { ...snapshot(updated), decision: result.decision },
    sourceType: m.sourceType,
    reason: result.reason,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: result };
}

export function markPromotionAppliedPure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  decision: MemoryPromotionResult["decision"]
): EngineResult<MemoryRecord> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const status =
    decision === "PROPOSE_IDENTITY_CLAIM"
      ? ("PROPOSED_IDENTITY" as const)
      : decision === "ATTACH_IDENTITY_EVIDENCE"
        ? ("ATTACHED_EVIDENCE" as const)
        : decision === "FUTURE_GRAPH_CANDIDATE"
          ? ("FUTURE_GRAPH_CANDIDATE" as const)
          : ("EVALUATED" as const);
  const updated: MemoryRecord = {
    ...m,
    promotionStatus: status,
    updatedAt: new Date().toISOString(),
  };
  let next: MemoryEngineState = {
    ...state,
    memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
  };
  next = audit(next, {
    userId,
    workspaceId: m.workspaceId,
    memoryId,
    experienceId: m.experienceId,
    action: "promote_apply",
    previousState: snapshot(m),
    nextState: snapshot(updated),
    sourceType: "identity_engine",
    reason: `Promoção aplicada: ${decision}`,
    correlationId: null,
  });
  return { ok: true, error: null, state: next, data: updated };
}

export function expireMemoriesPure(
  state: MemoryEngineState,
  userId: string,
  now = Date.now()
): MemoryEngineState {
  const at = new Date(now).toISOString();
  let next = state;
  for (const m of state.memories) {
    if (m.userId !== userId) continue;
    if (!isExpired(m, now)) continue;
    if (m.status === "ARCHIVED" || m.status === "DELETED" || m.status === "OUTDATED") {
      continue;
    }
    const updated: MemoryRecord = {
      ...m,
      status: "OUTDATED",
      archivedAt: m.archivedAt ?? at,
      updatedAt: at,
      weight: 0,
    };
    next = {
      ...next,
      memories: next.memories.map((x) => (x.id === m.id ? updated : x)),
    };
    next = audit(next, {
      userId,
      workspaceId: m.workspaceId,
      memoryId: m.id,
      experienceId: m.experienceId,
      action: "expire",
      previousState: snapshot(m),
      nextState: snapshot(updated),
      sourceType: m.sourceType,
      reason: `Expiração determinística (${m.retentionPolicy})`,
      correlationId: null,
    });
  }
  return next;
}

export function getMemoryContextForBrainPure(
  state: MemoryEngineState,
  userId: string,
  input?: { context?: string; workspaceId?: string | null; limit?: number }
): MemoryBrainContext {
  const limit = Math.min(input?.limit ?? 6, 12);
  const { items } = searchMemoriesPure(state, userId, {
    workspaceId: input?.workspaceId,
    context: input?.context,
    limit: 40,
  });

  let excludedRejected = 0;
  let excludedDeleted = 0;
  const eligible = items.filter((m) => {
    if (m.status === "REJECTED") {
      excludedRejected++;
      return false;
    }
    if (m.status === "DELETED" || m.deletedAt) {
      excludedDeleted++;
      return false;
    }
    if (BLOCKED_FROM_RECALL.includes(m.status)) return false;
    if (m.promotionStatus === "BLOCKED") return false;
    if (isExpired(m)) return false;
    return true;
  });

  const selected = eligible
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);

  return {
    memories: selected.map((m) => ({
      id: m.id,
      memoryType: m.memoryType,
      title: m.title,
      content: m.content,
      status: m.status,
      confidence: m.confidence,
      confidenceBand: m.confidenceBand,
      importance: m.importance,
      sourceType: m.sourceType,
      isFact: m.status === "CONFIRMED" || m.memoryType === "SEMANTIC",
      isHypothesis:
        m.status === "PENDING_REVIEW" ||
        m.memoryType === "REFLECTIVE" ||
        m.confidence < 40,
      context: m.context,
    })),
    meta: {
      generatedAt: new Date().toISOString(),
      count: selected.length,
      excludedRejected,
      excludedDeleted,
    },
    executionInfluence: "none",
  };
}

/** Attach independent evidence reinforcing an existing memory (non-identical source). */
export function attachEvidencePure(
  state: MemoryEngineState,
  userId: string,
  memoryId: string,
  evidence: Omit<MemoryEvidence, "id">
): EngineResult<MemoryRecord> {
  const m = getMemoryPure(state, userId, memoryId);
  if (!m) return { ok: false, error: "Memória não encontrada", state, data: null };
  const independent = !m.evidence.some(
    (e) =>
      e.sourceType === evidence.sourceType &&
      e.sourceReference?.entityId === evidence.sourceReference?.entityId
  );
  const nextConf = reinforceConfidence(
    m.confidence,
    evidence.strength,
    independent
  );
  const at = new Date().toISOString();
  const entry: MemoryEvidence = { ...evidence, id: uid("evid") };
  const updated: MemoryRecord = {
    ...m,
    evidence: [...m.evidence, entry].slice(0, 40),
    confidence: nextConf,
    confidenceBand: confidenceBand(nextConf),
    weight: initialWeight({ confidence: nextConf, importance: m.importance }),
    updatedAt: at,
    scoreHistory: pushScoreHistory(
      m.scoreHistory,
      "confidence",
      m.confidence,
      nextConf,
      independent ? "evidência independente" : "evidência não independente (sem inflação)",
      "system",
      at
    ),
  };
  return {
    ok: true,
    error: null,
    state: {
      ...state,
      memories: state.memories.map((x) => (x.id === memoryId ? updated : x)),
    },
    data: updated,
  };
}
