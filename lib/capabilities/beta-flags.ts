/**
 * Beta feature flags — gradual rollout. Never substitutes authorization.
 */

import { setFeatureFlagPure } from "@/lib/capabilities/feature-flags";
import type { PlatformState, ResolveContext } from "@/lib/capabilities/types";

export const BETA_FEATURE_FLAGS = [
  "beta.agents",
  "beta.automations",
  "beta.learning",
  "beta.conversations",
  "beta.advanced_discovery",
  "beta.private_skills",
  "beta.admin_tools",
] as const;

export function ensureBetaFeatureFlags(
  state: PlatformState,
  ctx: ResolveContext,
  env = process.env.NODE_ENV ?? "development"
): PlatformState {
  let s = state;
  for (const key of BETA_FEATURE_FLAGS) {
    const exists = s.featureFlags.some(
      (f) => f.key === key && f.scope === "environment" && f.environment === env
    );
    if (exists) continue;
    // Default: enable most beta modules in non-production; keep admin tools env-gated
    const enabled = key === "beta.admin_tools" ? env !== "production" : true;
    const res = setFeatureFlagPure(
      s,
      {
        key,
        scope: "environment",
        enabled,
        environment: env,
        reason: "sprint10.1_beta_default",
      },
      ctx
    );
    if (res.ok) s = res.state;
  }
  return s;
}
