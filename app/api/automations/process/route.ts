/**
 * Protected batch processor for eligible automations (Sprint 8.1).
 *
 * Scheduling V1 limitations:
 * - Prefer manual execution + this authenticated endpoint.
 * - If using Vercel Cron: set CRON_SECRET, authenticate via Authorization Bearer,
 *   process limit=1 (or small batch), never expose service role to the client.
 * - Hobby cron may run at most once/day — document plan limits separately.
 * - Unattended AUTO_SAFE still requires allowAutoSafe + LOW gates.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> OR x-cron-secret header.
 * Does not depend on browser session.
 */

import { NextResponse } from "next/server";
import {
  clearActions,
  ensureBuiltinActions,
} from "@/lib/aura-brain/actions/registry";
import {
  getAuraBrainSettings,
  setAuraBrainSettings,
} from "@/lib/aura-brain/context";
import {
  automationStoreKey,
  getAutomationState,
  processEligibleAutomationsPure,
  setAutomationState,
} from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-cron-secret")?.trim() ?? "";
  return bearer === secret || header === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "1") || 1, 5);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      {
        error: "userId_required",
        note: "Cron worker must target a user store key; no service-role fan-out in V1.",
      },
      { status: 400 }
    );
  }

  ensureBuiltinActions();
  const workspaceId = url.searchParams.get("workspaceId");
  const key = automationStoreKey(userId, workspaceId);
  const settings = getAuraBrainSettings(userId);
  // Ensure kill-switch respected
  setAuraBrainSettings(userId, settings);

  const viewer = {
    userId,
    workspaceId: workspaceId || null,
    role: "owner" as const,
    isWorkspaceMember: Boolean(workspaceId),
  };

  const res = await processEligibleAutomationsPure(
    getAutomationState(key),
    viewer,
    settings,
    { limit, leaseOwner: `cron:${userId}` }
  );
  setAutomationState(key, res.state);

  return NextResponse.json({
    ok: true,
    processed: res.processed,
    results: res.results,
    limitation:
      "V1: per-user processing only; no multi-tenant fan-out; prefer manual when unattended path is not configured.",
  });
}

// Keep registry warm in tests without leaking between suites
export function __resetForTests(): void {
  clearActions();
  ensureBuiltinActions();
}
