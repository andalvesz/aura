/**
 * User diagnostics — sanitized copyable snapshot.
 */

import { getCurrentReleaseVersion } from "@/lib/beta-ops/releases";
import { getBetaOpsState } from "@/lib/beta-ops/store";
import { getAnalyticsConsent } from "@/lib/beta-ops/analytics";
import { getUserCohort } from "@/lib/beta-ops/cohorts";
import { listErrorGroups } from "@/lib/beta-ops/errors";
import { getRequestCorrelationId } from "@/lib/beta-ops/correlation";
import { getBetaAccess } from "@/lib/capabilities/beta-access-store";
import { getPlatformState } from "@/lib/capabilities/store";
import { resolveCapabilities, resolveSkills } from "@/lib/capabilities/resolver";
import type { ResolveContext } from "@/lib/capabilities/types";
import { resolveRollout } from "@/lib/beta-ops/rollout";

const SECRET_PATTERNS = [/token/i, /secret/i, /password/i, /api[_-]?key/i, /authorization/i];

export type DiagnosticsSnapshot = {
  version: string | null;
  environment: string;
  auth: { authenticated: boolean; userId: string };
  workspace: { id: string | null; slug: string | null; role: string };
  cohort: string | null;
  betaStatus: string | null;
  capabilities: string[];
  skills: string[];
  featureFlags: Array<{ key: string; enabled: boolean }>;
  rollouts: Array<{ key: string; enabled: boolean; reason: string }>;
  connections: { supabase: string; persistence: string };
  queues: { offlineSync: string };
  migrationsDetected: string[];
  recentErrors: Array<{ code: string; at: string }>;
  correlationIds: string[];
  consents: ReturnType<typeof getAnalyticsConsent>;
  generatedAt: string;
};

export function buildDiagnosticsSnapshot(params: {
  ctx: ResolveContext;
  pendingMigrations?: string[];
}): DiagnosticsSnapshot {
  const platform = getPlatformState();
  const caps = resolveCapabilities(platform, params.ctx);
  const skills = resolveSkills(platform, params.ctx);
  const beta = getBetaAccess(params.ctx.userId);
  const errors = listErrorGroups(getBetaOpsState()).slice(0, 5);
  const rollouts = getBetaOpsState().rollouts.map((r) => {
    const res = resolveRollout(r.key, {
      userId: params.ctx.userId,
      workspaceId: params.ctx.workspaceId,
      environment: params.ctx.environment,
    });
    return { key: r.key, enabled: res.enabled, reason: res.reason };
  });

  return {
    version: getCurrentReleaseVersion() ?? "10.2.0-beta",
    environment: params.ctx.environment ?? process.env.NODE_ENV ?? "development",
    auth: { authenticated: true, userId: params.ctx.userId },
    workspace: {
      id: params.ctx.workspaceId,
      slug: params.ctx.workspaceSlug,
      role: params.ctx.role,
    },
    cohort: getUserCohort(params.ctx.userId),
    betaStatus: beta?.accessStatus ?? null,
    capabilities: caps.filter((c) => c.enabled).map((c) => c.definition.id),
    skills: skills.filter((s) => s.status !== "available").map((s) => s.definition.id),
    featureFlags: platform.featureFlags
      .filter(
        (f) =>
          f.scope === "system" ||
          f.userId === params.ctx.userId ||
          f.workspaceId === params.ctx.workspaceId
      )
      .map((f) => ({ key: f.key, enabled: f.enabled })),
    rollouts,
    connections: {
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? "configured" : "missing",
      persistence: process.env.AURA_PLATFORM_PERSISTENCE ?? "auto",
    },
    queues: { offlineSync: "unknown" },
    migrationsDetected: params.pendingMigrations ?? [],
    recentErrors: errors.map((e) => ({ code: e.code, at: e.lastSeen })),
    correlationIds: [getRequestCorrelationId(), ...errors.map((e) => e.id)].slice(0, 8),
    consents: getAnalyticsConsent(params.ctx.userId),
    generatedAt: new Date().toISOString(),
  };
}

export function sanitizeDiagnosticsForCopy(snap: DiagnosticsSnapshot): string {
  const json = JSON.stringify(snap, null, 2);
  const lines = json.split("\n").filter((line) => {
    return !SECRET_PATTERNS.some((p) => p.test(line) && /:\s*"[^"]{8,}"/.test(line));
  });
  return lines.join("\n");
}

export function diagnosticsContainsSecrets(text: string): boolean {
  return SECRET_PATTERNS.some(
    (p) => p.test(text) && /eyJ|sk-|Bearer\s+[A-Za-z0-9]/.test(text)
  );
}
