/**
 * Plan entitlements foundation — no billing, no commercial limits in 10.0.
 */

import {
  newId,
  nowIso,
  pushAudit,
  type PlatformState,
} from "@/lib/capabilities/store";
import type { EntitlementPlan, EntitlementRecord, ResolveContext } from "@/lib/capabilities/types";

export const PLAN_CATALOG: Record<
  EntitlementPlan,
  { label: string; futureLimits: Record<string, number | null> }
> = {
  FREE: { label: "Free", futureLimits: { skills: 5, workspaces: 1 } },
  PRO: { label: "Pro", futureLimits: { skills: 50, workspaces: 5 } },
  BUSINESS: { label: "Business", futureLimits: { skills: null, workspaces: null } },
  CUSTOM: { label: "Custom", futureLimits: { skills: null, workspaces: null } },
};

/**
 * Sprint 10.0: all current users keep full access.
 * Commercial limitations are NOT applied.
 */
export function resolveEntitlementPure(
  state: PlatformState,
  ctx: ResolveContext,
  preferredPlan: EntitlementPlan = "CUSTOM"
): { state: PlatformState; entitlement: EntitlementRecord } {
  const existing = state.entitlements.find(
    (e) => e.userId === ctx.userId && e.workspaceId === ctx.workspaceId
  );
  if (existing) {
    return { state, entitlement: { ...existing, fullAccess: true } };
  }
  const entitlement: EntitlementRecord = {
    id: newId("ent"),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    plan: preferredPlan,
    fullAccess: true,
    features: ["*"],
    resolvedAt: nowIso(),
  };
  let s: PlatformState = {
    ...state,
    entitlements: [...state.entitlements, entitlement],
  };
  s = pushAudit(s, {
    event: "entitlement_resolved",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "entitlement",
    subjectId: entitlement.id,
    summary: `Plan ${preferredPlan} with fullAccess`,
    metadata: { plan: preferredPlan, fullAccess: true },
  });
  return { state: s, entitlement };
}

export function commercialLimitWouldBlock(_metric: string, _value: number): boolean {
  // Never block in Sprint 10.0
  return false;
}

export function assertEntitlementNotTampered(
  stored: EntitlementRecord,
  clientClaim: Partial<EntitlementRecord> | null | undefined
): boolean {
  if (!clientClaim) return true;
  if (clientClaim.plan && clientClaim.plan !== stored.plan) return false;
  if (clientClaim.fullAccess === false && stored.fullAccess) return false;
  return true;
}
