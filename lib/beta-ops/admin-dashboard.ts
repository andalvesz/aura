/**
 * Admin Beta Dashboard aggregates — no private user content.
 */

import { listBetaInvites } from "@/lib/beta-ops/invites";
import { listCohorts } from "@/lib/beta-ops/cohorts";
import { listAllFeedback } from "@/lib/beta-ops/feedback";
import { listErrorGroups, sanitizeErrorGroupForUi } from "@/lib/beta-ops/errors";
import { getBetaOpsState } from "@/lib/beta-ops/store";
import { aggregateUsageMetrics } from "@/lib/beta-ops/analytics";
import { averageTimeToFirstValueMs } from "@/lib/beta-ops/first-value";
import { buildProductHealthReport } from "@/lib/beta-ops/product-health";
import { listReleasedChangelog } from "@/lib/beta-ops/releases";
import { listBetaAccessAggregated } from "@/lib/capabilities/beta-access-store";
import { buildAdminSnapshot } from "@/lib/capabilities/admin";
import { getPlatformState } from "@/lib/capabilities/store";
import { buildPlatformHealth, sanitizeHealthForUi } from "@/lib/capabilities/health";

export type AdminBetaDashboard = {
  invites: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    revoked: number;
  };
  users: ReturnType<typeof listBetaAccessAggregated>;
  cohorts: Array<{ id: string; label: string }>;
  retention: {
    firstValueAvgMs: number | null;
    firstValueCount: number;
  };
  recentErrors: ReturnType<typeof sanitizeErrorGroupForUi>[];
  feedback: { total: number; bugs: number; newCount: number };
  featureFlags: number;
  rollouts: Array<{ key: string; percent: number; enabled: boolean }>;
  versions: Array<{ version: string; channel: string; status: string }>;
  pendingMigrations: string[];
  health: ReturnType<typeof sanitizeHealthForUi>;
  productHealth: ReturnType<typeof buildProductHealthReport>;
  usage: ReturnType<typeof aggregateUsageMetrics>;
  workspacesActive: number;
  onboardingIncomplete: number;
};

export function buildAdminBetaDashboard(adminUserId: string): {
  ok: boolean;
  dashboard: AdminBetaDashboard | null;
} {
  const snap = buildAdminSnapshot(getPlatformState(), adminUserId);
  if (!snap.ok || !snap.snapshot) return { ok: false, dashboard: null };

  const invites = listBetaInvites();
  const feedback = listAllFeedback();
  const state = getBetaOpsState();
  const health = sanitizeHealthForUi(buildPlatformHealth({}));

  return {
    ok: true,
    dashboard: {
      invites: {
        total: invites.length,
        pending: invites.filter((i) => i.status === "PENDING").length,
        accepted: invites.filter((i) => i.status === "ACCEPTED").length,
        expired: invites.filter((i) => i.status === "EXPIRED").length,
        revoked: invites.filter((i) => i.status === "REVOKED").length,
      },
      users: listBetaAccessAggregated(),
      cohorts: listCohorts().map((c) => ({ id: c.id, label: c.label })),
      retention: {
        firstValueAvgMs: averageTimeToFirstValueMs(state),
        firstValueCount: state.firstValueEvents.length,
      },
      recentErrors: listErrorGroups(state).slice(0, 20).map(sanitizeErrorGroupForUi),
      feedback: {
        total: feedback.length,
        bugs: feedback.filter((f) => f.type === "BUG").length,
        newCount: feedback.filter((f) => f.status === "NEW").length,
      },
      featureFlags: snap.snapshot.featureFlags.length,
      rollouts: state.rollouts.map((r) => ({
        key: r.key,
        percent: r.percent,
        enabled: r.enabled,
      })),
      versions: listReleasedChangelog(state)
        .concat(state.releases.filter((r) => r.status === "DRAFT" || r.status === "READY"))
        .slice(0, 15)
        .map((r) => ({ version: r.version, channel: r.channel, status: r.status })),
      pendingMigrations: snap.snapshot.pendingMigrations,
      health,
      productHealth: buildProductHealthReport(),
      usage: aggregateUsageMetrics(state),
      workspacesActive: 0, // aggregated only — no private workspace content
      onboardingIncomplete: Object.values(getPlatformState().onboardingByUser).filter(
        (o) => !o.completed
      ).length,
    },
  };
}
