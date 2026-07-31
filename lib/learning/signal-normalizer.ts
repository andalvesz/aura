/**
 * Normalize raw events into LearningSignal. Blocks unregistered adapters/events.
 */

import {
  getLearningAdapter,
  isEventRegistered,
} from "@/lib/learning/registry";
import type {
  LearningSignal,
  LearningSignalType,
  LearningSourceLayer,
  LearningState,
} from "@/lib/learning/types";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const EVENT_TO_TYPE: Record<string, LearningSignalType> = {
  util: "USEFUL",
  useful: "USEFUL",
  nao_util: "NOT_USEFUL",
  not_useful: "NOT_USEFUL",
  concluido: "COMPLETED",
  completed: "COMPLETED",
  ignorado: "IGNORED",
  ignore: "IGNORED",
  ignored: "IGNORED",
  accept: "RECOMMENDATION_ACCEPTED",
  accepted: "ACCEPTED",
  reject: "REJECTED",
  rejected: "REJECTED",
  archive: "IGNORED",
  confirmed: "CONFIRMED",
  corrected: "CORRECTED",
  succeeded: "AUTOMATION_SUCCEEDED",
  failed: "FAILED",
  plan_succeeded: "PLAN_SUCCEEDED",
  plan_failed: "PLAN_FAILED",
  automation_failed: "AUTOMATION_FAILED",
  agent_completed: "AGENT_COMPLETED",
  agent_partial: "AGENT_PARTIAL",
  agent_blocked: "AGENT_BLOCKED",
  waiting_input: "AGENT_BLOCKED",
  rated: "CONVERSATION_RATED",
  discovery_confirmed: "DISCOVERY_CONFIRMED",
  discovery_rejected: "DISCOVERY_REJECTED",
  memory_corrected: "MEMORY_CORRECTED",
  identity_corrected: "IDENTITY_CORRECTED",
  nao_sugerir_novamente: "REJECTED",
  undone: "UNDONE",
  retried: "RETRIED",
  paused: "PAUSED",
  abandoned: "ABANDONED",
  deadline_changed: "DEADLINE_CHANGED",
  owner_changed: "OWNER_CHANGED",
};

export type RawLearningEvent = {
  userId: string;
  workspaceId?: string | null;
  sourceLayer: LearningSourceLayer;
  event: string;
  sourceType: string;
  sourceId: string;
  subjectType: string;
  subjectId: string;
  actorId?: string;
  value?: number;
  confidence?: number;
  occurredAt?: string;
  idempotencyKey: string;
  context?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export function normalizeLearningSignal(
  raw: RawLearningEvent
): { signal: LearningSignal | null; error: string | null } {
  if (!isEventRegistered(raw.sourceLayer, raw.event)) {
    return { signal: null, error: "event_not_registered" };
  }
  const adapter = getLearningAdapter(raw.sourceLayer);
  if (!adapter) return { signal: null, error: "adapter_missing" };

  const signalType =
    EVENT_TO_TYPE[raw.event.toLowerCase()] ??
    (raw.event.toUpperCase() as LearningSignalType);

  const allowed: LearningSignalType[] = [
    "CONFIRMED",
    "REJECTED",
    "CORRECTED",
    "ACCEPTED",
    "IGNORED",
    "USEFUL",
    "NOT_USEFUL",
    "COMPLETED",
    "FAILED",
    "UNDONE",
    "RETRIED",
    "PAUSED",
    "ABANDONED",
    "DEADLINE_CHANGED",
    "OWNER_CHANGED",
    "PLAN_SUCCEEDED",
    "PLAN_FAILED",
    "AUTOMATION_SUCCEEDED",
    "AUTOMATION_FAILED",
    "AGENT_COMPLETED",
    "AGENT_PARTIAL",
    "AGENT_BLOCKED",
    "CONVERSATION_RATED",
    "RECOMMENDATION_ACCEPTED",
    "RECOMMENDATION_REJECTED",
    "DISCOVERY_CONFIRMED",
    "DISCOVERY_REJECTED",
    "MEMORY_CORRECTED",
    "IDENTITY_CORRECTED",
  ];
  const type = allowed.includes(signalType) ? signalType : "IGNORED";

  const now = raw.occurredAt ?? new Date().toISOString();
  return {
    signal: {
      id: nid("sig"),
      userId: raw.userId,
      workspaceId: raw.workspaceId ?? null,
      signalType: type,
      sourceLayer: raw.sourceLayer,
      sourceType: raw.sourceType,
      sourceId: raw.sourceId,
      subjectType: raw.subjectType,
      subjectId: raw.subjectId,
      actorId: raw.actorId ?? raw.userId,
      context: raw.context ?? {},
      value: raw.value ?? 1,
      weight: adapter.defaultWeight,
      confidence: Math.min(1, Math.max(0, raw.confidence ?? 0.7)),
      occurredAt: now,
      idempotencyKey: raw.idempotencyKey,
      metadata: raw.metadata ?? {},
      createdAt: now,
      softDeleted: false,
    },
    error: null,
  };
}

export function ingestLearningSignal(
  state: LearningState,
  raw: RawLearningEvent
): { state: LearningState; signal: LearningSignal | null; error: string | null; deduped: boolean } {
  const key = `${raw.userId}:${raw.idempotencyKey}`;
  if (state.idempotencyIndex[key]) {
    const existing =
      state.signals.find((s) => s.id === state.idempotencyIndex[key]) ?? null;
    return { state, signal: existing, error: null, deduped: true };
  }
  const { signal, error } = normalizeLearningSignal(raw);
  if (!signal || error) return { state, signal: null, error: error ?? "normalize_failed", deduped: false };

  // Isolation: never attach another user's private signal
  if (signal.actorId !== raw.userId && signal.metadata.private === true) {
    return { state, signal: null, error: "private_cross_user", deduped: false };
  }

  const next: LearningState = {
    ...state,
    signals: [signal, ...state.signals],
    idempotencyIndex: {
      ...state.idempotencyIndex,
      [key]: signal.id,
    },
  };
  return { state: next, signal, error: null, deduped: false };
}
