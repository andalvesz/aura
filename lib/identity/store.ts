/**
 * In-memory Identity store (process) + optional sync helpers.
 * Mirrors Mission/Aura Brain settings pattern for tests and best-effort runtime.
 */

import type {
  IdentityAuditEvent,
  IdentityClaim,
} from "@/lib/identity/types";
import type { IdentityEngineState } from "@/lib/identity/engine";
import { createEmptyIdentityState } from "@/lib/identity/engine";

const states = new Map<string, IdentityEngineState>();
const profileCache = new Map<string, { at: number; payload: unknown }>();

function key(userId: string): string {
  return userId;
}

export function getIdentityState(userId: string): IdentityEngineState {
  const existing = states.get(key(userId));
  if (existing) {
    return {
      claims: existing.claims.map((c) => structuredClone(c)),
      audits: existing.audits.map((a) => structuredClone(a)),
    };
  }
  return createEmptyIdentityState();
}

export function setIdentityState(
  userId: string,
  state: IdentityEngineState
): void {
  states.set(key(userId), {
    claims: state.claims.map((c) => structuredClone(c)),
    audits: state.audits.map((a) => structuredClone(a)),
  });
  invalidateIdentityProfileCache(userId);
}

export function clearIdentityState(userId?: string): void {
  if (userId) {
    states.delete(key(userId));
    invalidateIdentityProfileCache(userId);
  } else {
    states.clear();
    profileCache.clear();
  }
}

export function profileCacheKey(
  userId: string,
  workspaceId: string | null | undefined,
  contextScope: string
): string {
  return `${userId}::${workspaceId ?? "personal"}::${contextScope}`;
}

export function getCachedIdentityProfile<T>(cacheKey: string): T | null {
  const hit = profileCache.get(cacheKey);
  if (!hit) return null;
  // Short TTL — corrections must feel immediate; callers also invalidate
  if (Date.now() - hit.at > 5_000) {
    profileCache.delete(cacheKey);
    return null;
  }
  return hit.payload as T;
}

export function setCachedIdentityProfile(
  cacheKey: string,
  payload: unknown
): void {
  profileCache.set(cacheKey, { at: Date.now(), payload });
}

export function invalidateIdentityProfileCache(userId: string): void {
  for (const k of profileCache.keys()) {
    if (k.startsWith(`${userId}::`)) profileCache.delete(k);
  }
}

export function listIdentityAudits(
  userId: string,
  limit = 50
): IdentityAuditEvent[] {
  return getIdentityState(userId).audits.slice(0, limit);
}

export function replaceIdentityClaims(
  userId: string,
  claims: IdentityClaim[]
): void {
  const state = getIdentityState(userId);
  setIdentityState(userId, { ...state, claims });
}
