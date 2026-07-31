"use server";

import { revalidatePath } from "next/cache";
import {
  acceptBetaInvite,
  buildAdminBetaDashboard,
  buildDiagnosticsSnapshot,
  buildSupportView,
  createAnnouncement,
  createBetaInvite,
  createFeedback,
  createMaintenanceRule,
  createRelease,
  getFeedbackById,
  getRequestCorrelationId,
  listAllFeedback,
  listBetaInvites,
  listFeedbackForUser,
  listReleasedChangelog,
  listVisibleAnnouncements,
  markReleaseReadPure,
  recordErrorOccurrence,
  resolveRollout,
  sanitizeDiagnosticsForCopy,
  setBetaOpsState,
  setReleaseStatus,
  updateFeedbackStatus,
  upsertRollout,
  getBetaOpsState,
  executeFlagRollback,
  listErrorGroups,
  sanitizeErrorGroupForUi,
  updateErrorGroupStatusPure,
  recordFirstValue,
  recordProductEvent,
  createCorrelationId,
} from "@/lib/beta-ops";
import type {
  BetaCohortId,
  FeedbackStatus,
  FeedbackType,
  FirstValueType,
  ReleaseChannel,
  AnnouncementKind,
  AnnouncementScope,
  ErrorGroupStatus,
} from "@/lib/beta-ops";
import { checkPlatformRateLimit } from "@/lib/capabilities/rate-limit";
import {
  canAccessAdminPlatform,
  getAdminAllowlistFromEnv,
} from "@/lib/capabilities/permissions";
import {
  loadPlatformStateForContext,
  resolveViewerContext,
} from "@/lib/capabilities/services/platform.service";
import { canAccessBeta, ensureBetaActive } from "@/lib/capabilities/beta-access";
import { revokeBetaInvitePure } from "@/lib/beta-ops/invites";

export type BetaOpsActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  correlationId?: string;
};

async function gated(): Promise<
  | { ok: true; ctx: Awaited<ReturnType<typeof resolveViewerContext>> }
  | { ok: false; error: string }
> {
  try {
    const ctx = await resolveViewerContext();
    ensureBetaActive(ctx.userId);
    if (!canAccessBeta(ctx.userId)) return { ok: false, error: "beta_access_denied" };
    return { ok: true, ctx };
  } catch {
    return { ok: false, error: "auth_required" };
  }
}

function requireAdmin(userId: string): boolean {
  return canAccessAdminPlatform({
    userId,
    allowedUserIds: getAdminAllowlistFromEnv(),
  });
}

export async function createBetaInviteAction(input: {
  email: string;
  cohort: BetaCohortId;
  experienceModeSuggested?: string | null;
  workspaceMode?: "personal" | "team" | "business" | null;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const rl = checkPlatformRateLimit("beta_invite", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  const corr = getRequestCorrelationId();
  const res = createBetaInvite({
    email: input.email,
    cohort: input.cohort,
    createdBy: gate.ctx.userId,
    experienceModeSuggested: input.experienceModeSuggested,
    workspaceMode: input.workspaceMode,
    correlationId: corr,
  });
  revalidatePath("/dashboard/admin/platform");
  return {
    ok: true,
    correlationId: corr,
    data: {
      inviteId: res.invite.id,
      acceptUrl: res.acceptUrl,
      // token returned once for admin to share — not persisted
      tokenOnce: res.token,
      expiresAt: res.invite.expiresAt,
    },
  };
}

export async function acceptBetaInviteAction(input: {
  token: string;
  email: string;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const rl = checkPlatformRateLimit("invite", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  const corr = getRequestCorrelationId();
  const res = acceptBetaInvite({
    token: input.token,
    userId: gate.ctx.userId,
    userEmail: input.email || gate.ctx.userId,
    correlationId: corr,
  });
  if (!res.ok) {
    recordProductEvent({
      name: "invite_failed",
      userId: gate.ctx.userId,
      correlationId: corr,
      metadata: { error: res.error },
    });
    return { ok: false, error: res.error, correlationId: corr };
  }
  recordProductEvent({
    name: "invite_accepted",
    userId: gate.ctx.userId,
    correlationId: corr,
  });
  revalidatePath("/dashboard");
  return { ok: true, correlationId: corr, data: { cohort: res.invite?.cohort } };
}

export async function revokeBetaInviteAction(inviteId: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = revokeBetaInvitePure(getBetaOpsState(), inviteId, gate.ctx.userId);
  if (res.ok) setBetaOpsState(res.state);
  revalidatePath("/dashboard/admin/platform");
  return { ok: res.ok, error: res.error };
}

export async function submitFeedbackAction(input: {
  title: string;
  description: string;
  type: FeedbackType;
  route?: string | null;
  context?: Record<string, unknown>;
  browserMetadata?: Record<string, string>;
  deviceMetadata?: Record<string, string>;
  correlationId?: string | null;
  appVersion?: string | null;
  lastErrorCode?: string | null;
  activeFeatureFlags?: string[];
  consentBugReport?: boolean;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const bucket = input.type === "BUG" ? "bug_report" : "feedback";
  const rl = checkPlatformRateLimit(bucket, gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  if (input.type === "BUG" && input.consentBugReport === false) {
    return { ok: false, error: "consent_required" };
  }
  const corr = input.correlationId || getRequestCorrelationId() || createCorrelationId();
  const res = createFeedback({
    title: input.title,
    description: input.description,
    type: input.type,
    route: input.route,
    context: input.context,
    browserMetadata: input.consentBugReport === false ? {} : input.browserMetadata,
    deviceMetadata: input.consentBugReport === false ? {} : input.deviceMetadata,
    correlationId: corr,
    createdBy: gate.ctx.userId,
    workspaceId: gate.ctx.workspaceId,
    appVersion: input.appVersion,
    lastErrorCode: input.lastErrorCode,
    activeFeatureFlags: input.activeFeatureFlags,
  });
  if (input.type === "BUG") {
    recordErrorOccurrence({
      code: input.lastErrorCode || "user_bug_report",
      route: input.route,
      workspaceId: gate.ctx.workspaceId,
      sampleMessage: input.title,
    });
  }
  recordProductEvent({
    name: input.type === "BUG" ? "bug_reported" : "feedback_submitted",
    userId: gate.ctx.userId,
    workspaceId: gate.ctx.workspaceId,
    correlationId: corr,
  });
  revalidatePath("/dashboard/feedback");
  return { ok: true, correlationId: corr, data: { id: res.item.id } };
}

export async function triageFeedbackAction(input: {
  feedbackId: string;
  status?: FeedbackStatus;
  priority?: number;
  linkedReleaseId?: string | null;
  duplicateOfId?: string | null;
  internalNotes?: string;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const rl = checkPlatformRateLimit("admin_action", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  const res = updateFeedbackStatus({ ...input, actorId: gate.ctx.userId });
  revalidatePath("/dashboard/admin/platform");
  revalidatePath("/dashboard/feedback");
  return { ok: res.ok, error: res.error, data: res.item };
}

export async function createReleaseAction(input: {
  version: string;
  channel: ReleaseChannel;
  title: string;
  summary: string;
  changes?: Array<{ kind: "feature" | "fix" | "improvement" | "known_issue"; text: string }>;
  knownIssues?: string[];
  migrationRequired?: boolean;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = createRelease({ ...input, createdBy: gate.ctx.userId });
  revalidatePath("/dashboard/changelog");
  revalidatePath("/dashboard/admin/platform");
  return { ok: true, data: { id: res.release.id } };
}

export async function publishReleaseAction(releaseId: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = setReleaseStatus({
    releaseId,
    status: "RELEASED",
    actorId: gate.ctx.userId,
    notifyUserIds: [gate.ctx.userId],
  });
  revalidatePath("/dashboard/changelog");
  return { ok: res.ok, error: res.error };
}

export async function markChangelogReadAction(releaseId: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  setBetaOpsState(markReleaseReadPure(getBetaOpsState(), gate.ctx.userId, releaseId));
  revalidatePath("/dashboard/changelog");
  return { ok: true };
}

export async function createAnnouncementAction(input: {
  kind: AnnouncementKind;
  title: string;
  body: string;
  scope: AnnouncementScope;
  scopeId?: string | null;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const rl = checkPlatformRateLimit("announcement", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  const res = createAnnouncement({ ...input, createdBy: gate.ctx.userId });
  revalidatePath("/dashboard/changelog");
  return { ok: true, data: { id: res.announcement.id } };
}

export async function upsertRolloutAction(input: {
  key: string;
  percent: number;
  cohorts?: BetaCohortId[];
  userIds?: string[];
  workspaceIds?: string[];
  environment?: string | null;
  enabled?: boolean;
  reason: string;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = upsertRollout({ ...input, updatedBy: gate.ctx.userId });
  revalidatePath("/dashboard/admin/platform");
  return { ok: true, data: res.rollout };
}

export async function rollbackFlagAction(key: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  executeFlagRollback(key, gate.ctx.userId);
  return { ok: true };
}

export async function updateErrorStatusAction(
  groupId: string,
  status: ErrorGroupStatus
): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = updateErrorGroupStatusPure(getBetaOpsState(), groupId, status);
  if (res.ok) setBetaOpsState(res.state);
  revalidatePath("/dashboard/admin/errors");
  return { ok: res.ok };
}

export async function createMaintenanceAction(input: {
  scope: "global" | "capability" | "route" | "workspace";
  scopeKey?: string | null;
  message: string;
}): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const res = createMaintenanceRule({ ...input, createdBy: gate.ctx.userId });
  revalidatePath("/dashboard");
  return { ok: true, data: { id: res.rule.id } };
}

export async function getDiagnosticsAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const rl = checkPlatformRateLimit("diagnostics", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  await loadPlatformStateForContext(gate.ctx);
  const snap = buildDiagnosticsSnapshot({ ctx: gate.ctx });
  const text = sanitizeDiagnosticsForCopy(snap);
  return { ok: true, data: { snapshot: snap, copyText: text } };
}

export async function getSupportViewAction(targetUserId: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const view = buildSupportView({ targetUserId, ctx: gate.ctx });
  return { ok: true, data: view };
}

export async function recordFirstValueAction(type: FirstValueType): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const res = recordFirstValue({ userId: gate.ctx.userId, type });
  return { ok: true, data: { alreadyHad: res.alreadyHad, event: res.event } };
}

export async function getAdminBetaDashboardAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  const dash = buildAdminBetaDashboard(gate.ctx.userId);
  return { ok: dash.ok, data: dash.dashboard, error: dash.ok ? undefined : "admin_denied" };
}

export async function listMyFeedbackAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  return { ok: true, data: listFeedbackForUser(gate.ctx.userId) };
}

export async function listChangelogAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const announcements = listVisibleAnnouncements(getBetaOpsState(), {
    userId: gate.ctx.userId,
    workspaceId: gate.ctx.workspaceId,
  });
  return {
    ok: true,
    data: {
      releases: listReleasedChangelog(),
      announcements,
      currentVersion: listReleasedChangelog()[0]?.version ?? "10.2.0-beta",
    },
  };
}

export async function listAdminErrorsAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  return {
    ok: true,
    data: listErrorGroups().map(sanitizeErrorGroupForUi),
  };
}

export async function resolveMyRolloutAction(key: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const res = resolveRollout(key, {
    userId: gate.ctx.userId,
    workspaceId: gate.ctx.workspaceId,
    environment: gate.ctx.environment,
  });
  return { ok: true, data: res };
}

export async function getFeedbackItemAction(id: string): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  const isAdmin = requireAdmin(gate.ctx.userId);
  const item = getFeedbackById(id, gate.ctx.userId, isAdmin);
  if (!item) return { ok: false, error: "not_found_or_forbidden" };
  return { ok: true, data: item };
}

export async function listInvitesAdminAction(): Promise<BetaOpsActionResult> {
  const gate = await gated();
  if (!gate.ok) return gate;
  if (!requireAdmin(gate.ctx.userId)) return { ok: false, error: "admin_denied" };
  return {
    ok: true,
    data: listBetaInvites().map((i) => ({
      id: i.id,
      email: i.email,
      status: i.status,
      cohort: i.cohort,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      // never expose tokenHash to client unnecessarily — omit raw hash details length only
      hasTokenHash: Boolean(i.tokenHash),
    })),
  };
}

/** Explicit: no impersonation endpoint exists. */
export async function impersonateUserAction(): Promise<BetaOpsActionResult> {
  return { ok: false, error: "impersonation_forbidden" };
}
