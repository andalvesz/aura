import { getUser } from "@/lib/auth";
import { PlatformAdminClient } from "@/components/dashboard/admin/platform-admin-client";
import { AdminBetaOpsPanel } from "@/components/dashboard/beta-ops/admin-beta-ops-panel";
import {
  buildAdminSnapshot,
  buildPlatformHealth,
  ensureBetaActive,
  getAdminAllowlistFromEnv,
  getPlatformState,
  listBetaAccessAggregated,
  sanitizeHealthForUi,
} from "@/lib/capabilities";
import {
  loadPlatformStateForContext,
  resolveViewerContext,
} from "@/lib/capabilities/services/platform.service";
import { buildAdminBetaDashboard, listBetaInvites } from "@/lib/beta-ops";
import Link from "next/link";

export default async function PlatformAdminPage() {
  let userId = "";
  try {
    const user = await getUser();
    userId = user?.id ?? "";
  } catch {
    userId = "";
  }

  const allow = getAdminAllowlistFromEnv(process.env);

  try {
    if (userId) {
      const ctx = await resolveViewerContext();
      await loadPlatformStateForContext(ctx);
      ensureBetaActive(ctx.userId);
    }
  } catch {
    /* ignore */
  }

  const { ok, snapshot } = buildAdminSnapshot(
    getPlatformState(),
    userId,
    process.env
  );

  const beta = listBetaAccessAggregated();
  const health = sanitizeHealthForUi(
    buildPlatformHealth({
      supabaseReachable: true,
      authOk: Boolean(userId),
      storageOk: null,
      migrationsApplied: null,
      dbTypesFresh: false,
      providersOk: null,
      automationsOk: null,
      agentsOk: null,
      recentErrorRate: 0,
    })
  );

  const betaDash = userId ? buildAdminBetaDashboard(userId) : { ok: false, dashboard: null };
  const invites = ok
    ? listBetaInvites().map((i) => ({
        id: i.id,
        email: i.email,
        status: i.status,
        cohort: i.cohort,
        expiresAt: i.expiresAt,
      }))
    : [];

  return (
    <div className="space-y-6">
      <PlatformAdminClient
        userId={userId}
        allowlistConfigured={allow.length > 0}
        ok={ok}
        snapshot={snapshot}
        beta={beta}
        platformHealth={health}
      />
      {ok && betaDash.ok && betaDash.dashboard ? (
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          <div className="flex gap-3 text-[12px]">
            <Link href="/dashboard/admin/errors" className="text-zinc-400 underline">
              Error Inbox
            </Link>
            <Link href="/dashboard/feedback" className="text-zinc-400 underline">
              Feedback
            </Link>
            <Link href="/dashboard/changelog" className="text-zinc-400 underline">
              Changelog
            </Link>
          </div>
          <AdminBetaOpsPanel dashboard={betaDash.dashboard} invites={invites} />
        </div>
      ) : null}
    </div>
  );
}
