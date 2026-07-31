/**
 * In-memory learning store. Migration prepares persistence.
 */

import type {
  LearningApplication,
  LearningAuditEntry,
  LearningEvaluation,
  LearningPattern,
  LearningProposal,
  LearningSignal,
  LearningState,
  LearningSuppression,
} from "@/lib/learning/types";

declare global {
  // eslint-disable-next-line no-var
  var __AURA_LEARNING_STATE__: Map<string, LearningState> | undefined;
}

function bucket(): Map<string, LearningState> {
  if (!globalThis.__AURA_LEARNING_STATE__) {
    globalThis.__AURA_LEARNING_STATE__ = new Map();
  }
  return globalThis.__AURA_LEARNING_STATE__;
}

export function createEmptyLearningState(): LearningState {
  return {
    signals: [],
    patterns: [],
    proposals: [],
    applications: [],
    evaluations: [],
    suppressions: [],
    audits: [],
    idempotencyIndex: {},
  };
}

export function clearLearningState(): void {
  bucket().clear();
}

export function getLearningState(userId: string): LearningState {
  const b = bucket();
  if (!b.has(userId)) b.set(userId, createEmptyLearningState());
  return cloneLearningState(b.get(userId)!);
}

export function setLearningState(userId: string, state: LearningState): void {
  bucket().set(userId, cloneLearningState(state));
}

export function cloneLearningState(state: LearningState): LearningState {
  return {
    signals: state.signals.map((s) => ({
      ...s,
      context: { ...s.context },
      metadata: { ...s.metadata },
    })),
    patterns: state.patterns.map((p) => ({
      ...p,
      signalIds: [...p.signalIds],
      counterSignalIds: [...p.counterSignalIds],
      timeRange: { ...p.timeRange },
    })),
    proposals: state.proposals.map((p) => ({
      ...p,
      context: { ...p.context },
      supportingSignalIds: [...p.supportingSignalIds],
      counterSignalIds: [...p.counterSignalIds],
      timeRange: { ...p.timeRange },
      proposedChange: {
        ...p.proposedChange,
        beforeSnapshot: { ...p.proposedChange.beforeSnapshot },
        afterSnapshot: { ...p.proposedChange.afterSnapshot },
      },
      affectedComponents: [...p.affectedComponents],
    })),
    applications: state.applications.map((a) => ({
      ...a,
      snapshotBefore: { ...a.snapshotBefore },
      snapshotAfter: { ...a.snapshotAfter },
    })),
    evaluations: state.evaluations.map((e) => ({
      ...e,
      limitations: [...e.limitations],
    })),
    suppressions: state.suppressions.map((s) => ({ ...s })),
    audits: state.audits.map((a) => ({ ...a, metadata: { ...a.metadata } })),
    idempotencyIndex: { ...state.idempotencyIndex },
  };
}

export function hashPayload(input: Record<string, unknown>): string {
  const raw = JSON.stringify(sortKeys(input));
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sortKeys(v as Record<string, unknown>);
    } else out[k] = v;
  }
  return out;
}

export function findProposal(
  state: LearningState,
  id: string
): LearningProposal | null {
  return state.proposals.find((p) => p.id === id && !p.softDeleted) ?? null;
}

export function findSignal(
  state: LearningState,
  id: string
): LearningSignal | null {
  return state.signals.find((s) => s.id === id && !s.softDeleted) ?? null;
}

export function findPattern(
  state: LearningState,
  id: string
): LearningPattern | null {
  return state.patterns.find((p) => p.id === id) ?? null;
}

export function findApplication(
  state: LearningState,
  id: string
): LearningApplication | null {
  return state.applications.find((a) => a.id === id) ?? null;
}

export function findEvaluation(
  state: LearningState,
  id: string
): LearningEvaluation | null {
  return state.evaluations.find((e) => e.id === id) ?? null;
}

export function pushLearningAudit(
  state: LearningState,
  entry: LearningAuditEntry
): LearningState {
  return { ...state, audits: [entry, ...state.audits].slice(0, 800) };
}

export function sanitizeLearningMeta(
  meta: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/prompt|token|secret|password|cot|chain/i.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v === null) out[k] = null;
  }
  return out;
}
