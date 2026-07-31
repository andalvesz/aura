/**
 * Feature flags — system / user / workspace / capability / environment.
 * Never a substitute for authorization.
 */

import {
  newId,
  nowIso,
  pushAudit,
  type PlatformState,
} from "@/lib/capabilities/store";
import type { FeatureFlag, FeatureFlagScope, ResolveContext } from "@/lib/capabilities/types";
import { canMutateCapability } from "@/lib/capabilities/permissions";

export function isFeatureEnabled(
  state: PlatformState,
  key: string,
  scope: {
    userId?: string | null;
    workspaceId?: string | null;
    capabilityId?: string | null;
    environment?: string | null;
  }
): boolean {
  const flags = state.featureFlags.filter((f) => f.key === key);
  if (!flags.length) return true; // absent = allow (flags gate gradually, not auth)

  // Most specific wins: capability > user > workspace > environment > system
  const scored = flags.map((f) => {
    let score = 0;
    if (f.scope === "capability" && f.capabilityId === scope.capabilityId) score = 50;
    else if (f.scope === "user" && f.userId === scope.userId) score = 40;
    else if (f.scope === "workspace" && f.workspaceId === scope.workspaceId) score = 30;
    else if (f.scope === "environment" && f.environment === (scope.environment ?? "development"))
      score = 20;
    else if (f.scope === "system") score = 10;
    else score = -1;
    return { f, score };
  });
  const best = scored.filter((x) => x.score >= 0).sort((a, b) => b.score - a.score)[0];
  if (!best) return true;
  return best.f.enabled;
}

export function setFeatureFlagPure(
  state: PlatformState,
  input: {
    key: string;
    scope: FeatureFlagScope;
    enabled: boolean;
    userId?: string | null;
    workspaceId?: string | null;
    capabilityId?: string | null;
    environment?: string | null;
    reason: string;
  },
  ctx: ResolveContext
): { state: PlatformState; ok: boolean; flag: FeatureFlag | null } {
  if (!canMutateCapability(ctx) && ctx.role !== "owner") {
    return { state, ok: false, flag: null };
  }
  const flag: FeatureFlag = {
    id: newId("ff"),
    key: input.key,
    scope: input.scope,
    enabled: input.enabled,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    capabilityId: input.capabilityId ?? null,
    environment: input.environment ?? null,
    reason: input.reason.slice(0, 200),
    updatedAt: nowIso(),
  };
  // Replace same scope key
  const filtered = state.featureFlags.filter(
    (f) =>
      !(
        f.key === flag.key &&
        f.scope === flag.scope &&
        f.userId === flag.userId &&
        f.workspaceId === flag.workspaceId &&
        f.capabilityId === flag.capabilityId &&
        f.environment === flag.environment
      )
  );
  let s: PlatformState = { ...state, featureFlags: [...filtered, flag] };
  s = pushAudit(s, {
    event: "feature_flag_updated",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "feature_flag",
    subjectId: flag.key,
    summary: `${flag.key}=${flag.enabled}`,
    metadata: { scope: flag.scope, reason: flag.reason },
  });
  return { state: s, ok: true, flag };
}

/** Client-sent flag overrides are ignored — only store state counts. */
export function rejectClientFlagOverride(
  clientClaim: { key: string; enabled: boolean } | null | undefined
): boolean {
  return Boolean(clientClaim);
}
