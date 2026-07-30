/**
 * Central cache invalidation for Aura Intelligence / Aura Brain.
 * Prefer scoped invalidation — avoid global clear.
 */

import {
  invalidateAuraIntelligenceCache as invalidateByUser,
} from "@/lib/intelligence/cache";

export type CacheInvalidationReason =
  | "gasto"
  | "receita"
  | "evento"
  | "treino"
  | "documento_expert_brain"
  | "habito"
  | "objetivo"
  | "viagem"
  | "idioma"
  | "workspace"
  | "manual"
  | "settings";

export type InvalidateAuraIntelligenceCacheParams = {
  userId: string;
  workspaceId?: string | null;
  reason: CacheInvalidationReason;
  context?: "personal" | "workspace";
};

/**
 * Invalidate intelligence cache for a user after relevant data changes.
 */
export function invalidateAuraIntelligenceCache(
  params: InvalidateAuraIntelligenceCacheParams | string,
  legacyContext?: "personal" | "workspace"
): void {
  // Back-compat: invalidateAuraIntelligenceCache(userId) / (userId, context)
  if (typeof params === "string") {
    invalidateByUser(params, legacyContext);
    return;
  }

  const ctx =
    params.context ??
    (params.reason === "workspace" ? "workspace" : "personal");

  // Workspace changes may also affect personal snapshot when switching contexts
  if (params.reason === "workspace") {
    invalidateByUser(params.userId, "workspace");
    return;
  }

  invalidateByUser(params.userId, ctx);
}

export { invalidateByUser as invalidateAuraIntelligenceCacheRaw };
