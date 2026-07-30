/**
 * In-memory Discovery store + short read cache.
 */

import type { DiscoveryEngineState } from "@/lib/discovery/engine";
import { createEmptyDiscoveryState } from "@/lib/discovery/engine";
import type { DiscoveryAuditEvent } from "@/lib/discovery/types";

const states = new Map<string, DiscoveryEngineState>();
const readCache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 5_000;

export function discoveryCacheKey(userId: string, suffix: string): string {
  return `${userId}::${suffix}`;
}

export function getDiscoveryState(userId: string): DiscoveryEngineState {
  return states.get(userId) ?? createEmptyDiscoveryState();
}

export function setDiscoveryState(
  userId: string,
  state: DiscoveryEngineState
): void {
  states.set(userId, state);
}

export function clearDiscoveryState(userId?: string): void {
  if (userId) {
    states.delete(userId);
    for (const key of readCache.keys()) {
      if (key.startsWith(`${userId}::`)) readCache.delete(key);
    }
  } else {
    states.clear();
    readCache.clear();
  }
}

export function getCachedDiscoveryRead<T>(key: string): T | null {
  const hit = readCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    readCache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCachedDiscoveryRead(key: string, value: unknown): void {
  readCache.set(key, { at: Date.now(), value });
}

export function invalidateDiscoveryCache(userId: string): void {
  for (const key of readCache.keys()) {
    if (key.startsWith(`${userId}::`)) readCache.delete(key);
  }
}

export function listDiscoveryAudits(
  userId: string,
  limit = 50
): DiscoveryAuditEvent[] {
  return getDiscoveryState(userId).audits.slice(0, limit);
}
