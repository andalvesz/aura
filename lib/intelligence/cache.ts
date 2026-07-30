/**
 * In-memory cache per user for Aura Intelligence results.
 */

import type { AuraIntelligenceResult } from "@/lib/intelligence/types";

type CacheEntry = {
  result: AuraIntelligenceResult;
  storedAt: number;
  context: "personal" | "workspace";
};

const DEFAULT_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry>();

function key(userId: string, context: "personal" | "workspace"): string {
  return `${userId}::${context}`;
}

export function getCachedIntelligence(
  userId: string,
  context: "personal" | "workspace",
  ttlMs = DEFAULT_TTL_MS
): AuraIntelligenceResult | null {
  const entry = cache.get(key(userId, context));
  if (!entry) return null;
  if (Date.now() - entry.storedAt > ttlMs) {
    cache.delete(key(userId, context));
    return null;
  }
  return {
    ...entry.result,
    meta: { ...entry.result.meta, cacheHit: true },
  };
}

export function setCachedIntelligence(
  userId: string,
  context: "personal" | "workspace",
  result: AuraIntelligenceResult
): void {
  cache.set(key(userId, context), {
    result: {
      ...result,
      meta: { ...result.meta, cacheHit: false },
    },
    storedAt: Date.now(),
    context,
  });
}

export function invalidateAuraIntelligenceCache(
  userId?: string,
  context?: "personal" | "workspace"
): void {
  if (!userId) {
    cache.clear();
    return;
  }
  if (context) {
    cache.delete(key(userId, context));
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(`${userId}::`)) cache.delete(k);
  }
}

export function getIntelligenceCacheSize(): number {
  return cache.size;
}
