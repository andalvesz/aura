/**
 * In-memory World Model store + short read cache.
 */

import type { WorldAuditEvent } from "@/lib/world-model/types";
import {
  createEmptyWorldState,
  type WorldModelState,
} from "@/lib/world-model/engine";

const states = new Map<string, WorldModelState>();
const readCache = new Map<string, { at: number; payload: unknown }>();

export function getWorldState(userId: string): WorldModelState {
  const existing = states.get(userId);
  if (existing) {
    return {
      entities: existing.entities.map((e) => structuredClone(e)),
      relationships: existing.relationships.map((r) => structuredClone(r)),
      suppressions: existing.suppressions.map((s) => structuredClone(s)),
      audits: existing.audits.map((a) => structuredClone(a)),
    };
  }
  return createEmptyWorldState();
}

export function setWorldState(userId: string, state: WorldModelState): void {
  states.set(userId, {
    entities: state.entities.map((e) => structuredClone(e)),
    relationships: state.relationships.map((r) => structuredClone(r)),
    suppressions: state.suppressions.map((s) => structuredClone(s)),
    audits: state.audits.map((a) => structuredClone(a)),
  });
  invalidateWorldCache(userId);
}

export function clearWorldState(userId?: string): void {
  if (userId) {
    states.delete(userId);
    invalidateWorldCache(userId);
  } else {
    states.clear();
    readCache.clear();
  }
}

export function worldCacheKey(
  userId: string,
  workspaceId: string | null | undefined,
  kind: string
): string {
  return `${userId}::${workspaceId ?? "personal"}::${kind}`;
}

export function getCachedWorldRead<T>(cacheKey: string): T | null {
  const hit = readCache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() - hit.at > 5_000) {
    readCache.delete(cacheKey);
    return null;
  }
  return hit.payload as T;
}

export function setCachedWorldRead(cacheKey: string, payload: unknown): void {
  readCache.set(cacheKey, { at: Date.now(), payload });
}

export function invalidateWorldCache(userId: string): void {
  for (const k of readCache.keys()) {
    if (k.startsWith(`${userId}::`)) readCache.delete(k);
  }
}

export function listWorldAudits(userId: string, limit = 50): WorldAuditEvent[] {
  return getWorldState(userId).audits.slice(0, limit);
}
