/**
 * In-memory Memory store (process) + short read cache.
 */

import type { MemoryAuditEvent, MemoryRecord } from "@/lib/memory/types";
import {
  createEmptyMemoryState,
  type MemoryEngineState,
} from "@/lib/memory/engine";

const states = new Map<string, MemoryEngineState>();
const readCache = new Map<string, { at: number; payload: unknown }>();

function key(userId: string): string {
  return userId;
}

export function getMemoryState(userId: string): MemoryEngineState {
  const existing = states.get(key(userId));
  if (existing) {
    return {
      experiences: existing.experiences.map((e) => structuredClone(e)),
      memories: existing.memories.map((m) => structuredClone(m)),
      feedbacks: existing.feedbacks.map((f) => structuredClone(f)),
      audits: existing.audits.map((a) => structuredClone(a)),
      promotions: existing.promotions.map((p) => structuredClone(p)),
    };
  }
  return createEmptyMemoryState();
}

export function setMemoryState(userId: string, state: MemoryEngineState): void {
  states.set(key(userId), {
    experiences: state.experiences.map((e) => structuredClone(e)),
    memories: state.memories.map((m) => structuredClone(m)),
    feedbacks: state.feedbacks.map((f) => structuredClone(f)),
    audits: state.audits.map((a) => structuredClone(a)),
    promotions: state.promotions.map((p) => structuredClone(p)),
  });
  invalidateMemoryCache(userId);
}

export function clearMemoryState(userId?: string): void {
  if (userId) {
    states.delete(key(userId));
    invalidateMemoryCache(userId);
  } else {
    states.clear();
    readCache.clear();
  }
}

export function memoryCacheKey(
  userId: string,
  workspaceId: string | null | undefined,
  kind: string
): string {
  return `${userId}::${workspaceId ?? "personal"}::${kind}`;
}

export function getCachedMemoryRead<T>(cacheKey: string): T | null {
  const hit = readCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.at > 5_000) {
    readCache.delete(cacheKey);
    return null;
  }
  return hit.payload as T;
}

export function setCachedMemoryRead(cacheKey: string, payload: unknown): void {
  readCache.set(cacheKey, { at: Date.now(), payload });
}

export function invalidateMemoryCache(userId: string): void {
  for (const k of readCache.keys()) {
    if (k.startsWith(`${userId}::`)) readCache.delete(k);
  }
}

export function listMemoryAudits(
  userId: string,
  limit = 50
): MemoryAuditEvent[] {
  return getMemoryState(userId).audits.slice(0, limit);
}

export function replaceMemories(
  userId: string,
  memories: MemoryRecord[]
): void {
  const state = getMemoryState(userId);
  setMemoryState(userId, { ...state, memories });
}
