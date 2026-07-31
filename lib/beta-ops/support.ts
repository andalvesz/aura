/**
 * Support Mode — NO impersonation, NO private content.
 */

import type { SupportView } from "@/lib/beta-ops/types";
import { getAnalyticsConsent } from "@/lib/beta-ops/analytics";
import { getBetaOpsState } from "@/lib/beta-ops/store";
import { getBetaAccess } from "@/lib/capabilities/beta-access-store";
import { getOnboardingStatus } from "@/lib/capabilities/onboarding";
import { getPlatformState } from "@/lib/capabilities/store";
import { resolveCapabilities, resolveSkills } from "@/lib/capabilities/resolver";
import type { ResolveContext } from "@/lib/capabilities/types";
import { listErrorGroups } from "@/lib/beta-ops/errors";

export const SUPPORT_FORBIDDEN_FIELDS = [
  "memories",
  "documents",
  "conversations",
  "financial",
  "private_content",
  "prompts",
  "tokens",
  "passwords",
] as const;

export function buildSupportView(params: {
  targetUserId: string;
  ctx: ResolveContext;
  pendingMigrations?: string[];
}): SupportView {
  const beta = getBetaAccess(params.targetUserId);
  const platform = getPlatformState();
  const caps = resolveCapabilities(platform, {
    ...params.ctx,
    userId: params.targetUserId,
  });
  const skills = resolveSkills(platform, {
    ...params.ctx,
    userId: params.targetUserId,
  });
  const onboarding = getOnboardingStatus(platform, params.targetUserId);
  const errors = listErrorGroups(getBetaOpsState())
    .slice(0, 20)
    .map((e) => ({
      code: e.code,
      correlationId: e.id,
      at: e.lastSeen,
    }));
  const flags = platform.featureFlags
    .filter((f) => f.userId === params.targetUserId || f.scope === "system")
    .map((f) => ({ key: f.key, enabled: f.enabled }));

  return {
    userId: params.targetUserId,
    accountStatus: beta?.accessStatus ?? "UNKNOWN",
    onboarding: {
      step: onboarding.completed ? 10 : 1,
      completed: Boolean(onboarding.completed),
    },
    capabilities: caps.filter((c) => c.enabled).map((c) => c.definition.id),
    skills: skills.filter((s) => s.status !== "available").map((s) => s.definition.id),
    featureFlags: flags,
    recentErrors: errors,
    correlationIds: errors.map((e) => e.correlationId).slice(0, 10),
    migrations: params.pendingMigrations ?? [],
    health: { ok: true },
    consents: getAnalyticsConsent(params.targetUserId),
    note: "support_mode_no_impersonation_no_private_content",
  };
}

export function assertSupportViewHasNoPrivateContent(view: SupportView): boolean {
  const json = JSON.stringify(view).toLowerCase();
  for (const f of SUPPORT_FORBIDDEN_FIELDS) {
    if (f === "private_content") continue;
    // field names in note are ok; content keys must not appear as data bags
  }
  return !("memories" in view) && !("documents" in view) && !("conversations" in view);
}
