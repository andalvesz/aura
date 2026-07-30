/**
 * In-memory Cognitive Engine store + short read cache.
 */

import type { CognitiveAuditEvent } from "@/lib/cognitive/types";
import {
  createEmptyCognitiveState,
  type CognitiveEngineState,
} from "@/lib/cognitive/engine";

const states = new Map<string, CognitiveEngineState>();
const readCache = new Map<string, { at: number; payload: unknown }>();

export function getCognitiveState(userId: string): CognitiveEngineState {
  const existing = states.get(userId);
  if (existing) {
    return {
      artifacts: existing.artifacts.map((a) => structuredClone(a)),
      feedbacks: existing.feedbacks.map((f) => structuredClone(f)),
      suppressions: existing.suppressions.map((s) => structuredClone(s)),
      runs: existing.runs.map((r) => structuredClone(r)),
      audits: existing.audits.map((a) => structuredClone(a)),
    };
  }
  return createEmptyCognitiveState();
}

export function setCognitiveState(
  userId: string,
  state: CognitiveEngineState
): void {
  states.set(userId, {
    artifacts: state.artifacts.map((a) => structuredClone(a)),
    feedbacks: state.feedbacks.map((f) => structuredClone(f)),
    suppressions: state.suppressions.map((s) => structuredClone(s)),
    runs: state.runs.map((r) => structuredClone(r)),
    audits: state.audits.map((a) => structuredClone(a)),
  });
  invalidateCognitiveCache(userId);
}

export function clearCognitiveState(userId?: string): void {
  if (userId) {
    states.delete(userId);
    invalidateCognitiveCache(userId);
  } else {
    states.clear();
    readCache.clear();
  }
}

export function cognitiveCacheKey(
  userId: string,
  workspaceId: string | null | undefined,
  kind: string
): string {
  return `${userId}::${workspaceId ?? "personal"}::${kind}`;
}

export function getCachedCognitiveRead<T>(cacheKey: string): T | null {
  const hit = readCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.at > 5_000) {
    readCache.delete(cacheKey);
    return null;
  }
  return hit.payload as T;
}

export function setCachedCognitiveRead(
  cacheKey: string,
  payload: unknown
): void {
  readCache.set(cacheKey, { at: Date.now(), payload });
}

export function invalidateCognitiveCache(userId: string): void {
  for (const k of readCache.keys()) {
    if (k.startsWith(`${userId}::`)) readCache.delete(k);
  }
}

export function listCognitiveAudits(
  userId: string,
  limit = 50
): CognitiveAuditEvent[] {
  return getCognitiveState(userId).audits.slice(0, limit);
}
