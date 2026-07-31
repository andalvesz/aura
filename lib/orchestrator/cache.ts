/**
 * Lightweight TTL cache for orchestrator reads (context / home).
 */

type Entry<T> = { value: T; expiresAt: number };

const cache = new Map<string, Entry<unknown>>();

export function clearOrchestratorCache(): void {
  cache.clear();
}

export function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = 15_000): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T> | T
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await factory();
  cacheSet(key, value, ttlMs);
  return value;
}
