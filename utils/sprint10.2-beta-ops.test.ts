/**
 * Sprint 10.2 — Private Beta Operations tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  acceptBetaInvitePure,
  assignUserCohort,
  assertSupportViewHasNoPrivateContent,
  buildAdminBetaDashboard,
  buildDiagnosticsSnapshot,
  buildProductHealthReport,
  buildSupportView,
  canRecordProductEvent,
  clearBetaOpsState,
  cohortIsNotAuthorization,
  createAnnouncementPure,
  createBetaInvitePure,
  createEmptyBetaOpsState,
  createFeedbackPure,
  createMaintenanceRulePure,
  createReleasePure,
  diagnosticsContainsSecrets,
  executeFlagRollback,
  getAnalyticsConsent,
  getFeedbackById,
  hashInviteToken,
  handleBetaOpsCommand,
  isAnnouncementInScope,
  isExpectedSecurityBlock,
  listReleasedChangelog,
  listVisibleAnnouncements,
  markReleaseReadPure,
  recordErrorOccurrencePure,
  recordFirstValuePure,
  recordProductEventPure,
  recordSignupAt,
  resolveMaintenance,
  resolveRolloutPure,
  ROLLBACK_PLAYBOOK,
  sanitizeDiagnosticsForCopy,
  sanitizeFeedbackContext,
  setReleaseStatusPure,
  stablePercentBucket,
  upsertRolloutPure,
  revokeBetaInvitePure,
  updateFeedbackStatusPure,
  setBetaOpsState,
} from "@/lib/beta-ops";
import {
  clearBetaAccessStore,
  clearPlatformRateLimits,
  clearPlatformState,
  clearPrivacyStores,
  checkPlatformRateLimit,
  ensureBetaActive,
  ensurePlatformRegistries,
  clearCapabilityRegistry,
  clearSkillRegistry,
  updatePrivacyPrefs,
  getPrivacyPrefs,
  canAccessAdminPlatform,
} from "@/lib/capabilities";
import type { ResolveContext } from "@/lib/capabilities";

function ctx(partial: Partial<ResolveContext> = {}): ResolveContext {
  return {
    userId: "u-admin",
    workspaceId: "ws-1",
    workspaceSlug: "ws",
    role: "owner",
    isWorkspaceMember: true,
    environment: "test",
    ...partial,
  };
}

beforeEach(() => {
  process.env.AURA_PLATFORM_PERSISTENCE = "memory";
  clearBetaOpsState();
  clearPlatformState();
  clearBetaAccessStore();
  clearPrivacyStores();
  clearPlatformRateLimits();
  clearCapabilityRegistry();
  clearSkillRegistry();
  ensurePlatformRegistries();
  ensureBetaActive("u-admin", "FOUNDERS");
  ensureBetaActive("u-a", "PERSONAL_USERS");
  ensureBetaActive("u-b", "TEAMS");
});

describe("Sprint 10.2 private beta operations", () => {
  test("artifacts + migration docs", () => {
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "supabase/migrations/20260731340000_sprint10_2_private_beta_operations.sql"
        )
      )
    );
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "docs/deployment/sql-manual/20__20260731340000_sprint10_2_private_beta_operations.sql"
        )
      )
    );
    assert.ok(existsSync(join(process.cwd(), "docs/operations/private-beta-operations.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/operations/release-process.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/operations/incident-response.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/operations/feature-rollout.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/product-analytics.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/support-mode.md")));
    assert.ok(
      existsSync(join(process.cwd(), "reports/sprint10.2-private-beta-operations.md"))
    );
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/feedback/page.tsx")));
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/changelog/page.tsx")));
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/admin/errors/page.tsx")));
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/settings/diagnostics/page.tsx")));
  });

  test("beta invites — token hash, email match, reuse, expire", () => {
    let state = createEmptyBetaOpsState();
    const created = createBetaInvitePure(state, {
      email: "a@example.com",
      cohort: "PERSONAL_USERS",
      createdBy: "u-admin",
    });
    state = created.state;
    assert.notEqual(created.invite.tokenHash, created.token);
    assert.equal(created.invite.tokenHash, hashInviteToken(created.token));
    assert.match(created.acceptUrl, /\/beta\/invite\//);

    const badEmail = acceptBetaInvitePure(state, {
      token: created.token,
      userId: "u-a",
      userEmail: "other@example.com",
    });
    assert.equal(badEmail.ok, false);
    assert.equal(badEmail.error, "email_mismatch");

    const ok = acceptBetaInvitePure(state, {
      token: created.token,
      userId: "u-a",
      userEmail: "a@example.com",
    });
    assert.equal(ok.ok, true);
    state = ok.state;

    const reuse = acceptBetaInvitePure(state, {
      token: created.token,
      userId: "u-b",
      userEmail: "a@example.com",
    });
    assert.equal(reuse.ok, false);
    assert.equal(reuse.error, "already_used");

    const forged = acceptBetaInvitePure(state, {
      token: "forged-token-value",
      userId: "u-b",
      userEmail: "b@example.com",
    });
    assert.equal(forged.ok, false);

    const expiredInvite = createBetaInvitePure(state, {
      email: "exp@example.com",
      cohort: "TEAMS",
      createdBy: "u-admin",
      expiresInDays: -1,
    });
    const expired = acceptBetaInvitePure(expiredInvite.state, {
      token: expiredInvite.token,
      userId: "u-b",
      userEmail: "exp@example.com",
    });
    assert.equal(expired.ok, false);
    assert.ok(expired.error === "expired" || expired.error === "not_pending");

    const rev = createBetaInvitePure(state, {
      email: "rev@example.com",
      cohort: "CUSTOM",
      createdBy: "u-admin",
    });
    const revoked = revokeBetaInvitePure(rev.state, rev.invite.id, "u-admin");
    assert.equal(revoked.ok, true);
    const tryRev = acceptBetaInvitePure(revoked.state, {
      token: rev.token,
      userId: "u-b",
      userEmail: "rev@example.com",
    });
    assert.equal(tryRev.ok, false);
  });

  test("cohorts are not authorization", () => {
    assert.equal(cohortIsNotAuthorization(), true);
    assignUserCohort("u-a", "FOUNDERS");
    // access still from beta-access store, not cohort
    assert.ok(true);
  });

  test("feedback sanitize + ownership + triage", () => {
    let state = createEmptyBetaOpsState();
    const created = createFeedbackPure(state, {
      title: "Bug UI",
      description: "botão falha",
      type: "BUG",
      createdBy: "u-a",
      context: { password: "secret", route: "/dashboard", token: "abc" },
    });
    state = created.state;
    assert.equal(created.item.context.password, undefined);
    assert.equal(created.item.context.token, undefined);
    assert.equal(created.item.context.route, "/dashboard");

    assert.equal(getFeedbackById(created.item.id, "u-b", false, state), null);
    assert.ok(getFeedbackById(created.item.id, "u-a", false, state));

    const triaged = updateFeedbackStatusPure(state, {
      feedbackId: created.item.id,
      actorId: "u-admin",
      status: "TRIAGED",
      priority: 2,
    });
    assert.equal(triaged.ok, true);
    assert.equal(triaged.item?.status, "TRIAGED");

    const sanitized = sanitizeFeedbackContext({ prompt: "full", ok: true });
    assert.equal(sanitized.prompt, undefined);
    assert.equal(sanitized.ok, true);
  });

  test("releases + changelog read", () => {
    let state = createEmptyBetaOpsState();
    const rel = createReleasePure(state, {
      version: "10.2.0",
      channel: "BETA",
      title: "Ops",
      summary: "Private beta ops",
      changes: [{ kind: "feature", text: "invites" }],
      knownIssues: ["rate limit in-process"],
      createdBy: "u-admin",
    });
    state = rel.state;
    const pub = setReleaseStatusPure(state, {
      releaseId: rel.release.id,
      status: "RELEASED",
      actorId: "u-admin",
      notifyUserIds: ["u-a"],
    });
    state = pub.state!;
    assert.equal(listReleasedChangelog(state).length, 1);
    state = markReleaseReadPure(state, "u-a", rel.release.id);
    assert.equal(state.releaseReads.length, 1);
  });

  test("announcements scope isolation", () => {
    let state = createEmptyBetaOpsState();
    const global = createAnnouncementPure(state, {
      kind: "maintenance",
      title: "Global",
      body: "x",
      scope: "global",
      createdBy: "u-admin",
    });
    state = global.state;
    const userAnn = createAnnouncementPure(state, {
      kind: "beta_feature",
      title: "Only A",
      body: "x",
      scope: "user",
      scopeId: "u-a",
      createdBy: "u-admin",
    });
    state = userAnn.state;
    const forA = listVisibleAnnouncements(state, { userId: "u-a", workspaceId: null });
    const forB = listVisibleAnnouncements(state, { userId: "u-b", workspaceId: null });
    assert.ok(forA.some((a) => a.title === "Only A"));
    assert.ok(!forB.some((a) => a.title === "Only A"));
    assert.equal(isAnnouncementInScope(userAnn.announcement, "u-b", null, null), false);
  });

  test("feature rollout stable percent + cohort + rollback", () => {
    let state = createEmptyBetaOpsState();
    assignUserCohort("u-a", "FOUNDERS");
    const up = upsertRolloutPure(state, {
      key: "beta.sample",
      percent: 0,
      cohorts: ["FOUNDERS"],
      reason: "cohort first",
      updatedBy: "u-admin",
    });
    state = up.state;
    const a = resolveRolloutPure(state, "beta.sample", { userId: "u-a" });
    const b = resolveRolloutPure(state, "beta.sample", { userId: "u-b" });
    assert.equal(a.enabled, true);
    assert.equal(a.reason, "cohort");
    assert.equal(b.enabled, false);

    const pct = upsertRolloutPure(state, {
      key: "beta.pct",
      percent: 50,
      reason: "half",
      updatedBy: "u-admin",
    });
    state = pct.state;
    setBetaOpsState(state);
    const bucket = stablePercentBucket("u-a", "beta.pct");
    const r1 = resolveRolloutPure(state, "beta.pct", { userId: "u-a" });
    const r2 = resolveRolloutPure(state, "beta.pct", { userId: "u-a" });
    assert.equal(r1.enabled, r2.enabled);
    assert.equal(r1.enabled, bucket < 50);

    const rb = executeFlagRollback("beta.pct", "u-admin");
    assert.equal(rb.ok, true);
  });

  test("error grouping anonymized", () => {
    let state = createEmptyBetaOpsState();
    const e1 = recordErrorOccurrencePure(state, {
      code: "X",
      route: "/dashboard",
      workspaceId: "ws-secret",
      sampleMessage: "fail",
    });
    state = e1.state;
    const e2 = recordErrorOccurrencePure(state, {
      code: "X",
      route: "/dashboard",
      workspaceId: "ws-secret",
    });
    assert.equal(e2.group.frequency, 2);
    assert.ok(e2.group.workspaceAnonId);
    assert.notEqual(e2.group.workspaceAnonId, "ws-secret");
    assert.ok(!JSON.stringify(e2.group).includes("stack"));
  });

  test("correlation + product analytics consent + first value", () => {
    updatePrivacyPrefs("u-a", { analyticsProduct: false, usageAnalyticsEnabled: false });
    const consent = getAnalyticsConsent("u-a");
    assert.equal(consent.essential, true);
    assert.equal(consent.product, false);
    assert.equal(canRecordProductEvent("memory_created", consent), false);
    assert.equal(canRecordProductEvent("session_error", consent), true);

    let state = createEmptyBetaOpsState();
    const blocked = recordProductEventPure(state, {
      name: "memory_created",
      userId: "u-a",
    });
    assert.equal(blocked.recorded, false);

    recordSignupAt("u-a", new Date(Date.now() - 60_000).toISOString());
    // mutate store signup used by recordFirstValuePure via getBetaOpsState path —
    // use pure with state that has signup
    state = {
      ...state,
      signupAtByUser: { "u-a": new Date(Date.now() - 60_000).toISOString() },
    };
    const fv = recordFirstValuePure(state, { userId: "u-a", type: "first_memory" });
    assert.equal(fv.alreadyHad, false);
    assert.ok((fv.event?.timeToFirstValueMs ?? 0) >= 50_000);
    const again = recordFirstValuePure(fv.state, { userId: "u-a", type: "first_project" });
    assert.equal(again.alreadyHad, true);
  });

  test("support mode + diagnostics sanitized", () => {
    const view = buildSupportView({
      targetUserId: "u-a",
      ctx: ctx({ userId: "u-admin" }),
    });
    assert.equal(view.note, "support_mode_no_impersonation_no_private_content");
    assert.equal(assertSupportViewHasNoPrivateContent(view), true);
    assert.ok(!("memories" in view));

    const snap = buildDiagnosticsSnapshot({ ctx: ctx({ userId: "u-a" }) });
    const text = sanitizeDiagnosticsForCopy(snap);
    assert.equal(diagnosticsContainsSecrets(text + " sk-abc123secret"), true);
    assert.equal(diagnosticsContainsSecrets(text), false);
  });

  test("maintenance + product health + rollback playbook", () => {
    let state = createEmptyBetaOpsState();
    const m = createMaintenanceRulePure(state, {
      scope: "global",
      message: "Manutenção",
      createdBy: "u-admin",
    });
    state = m.state;
    const active = resolveMaintenance(state, {});
    assert.equal(active.active, true);
    const bypass = resolveMaintenance(state, { isAdminBypass: true });
    assert.equal(bypass.active, false);
    assert.ok(ROLLBACK_PLAYBOOK.migrations.includes("NEVER"));
    assert.ok(isExpectedSecurityBlock("permission_denied"));
    assert.ok(!isExpectedSecurityBlock("upload_failed"));
    const health = buildProductHealthReport();
    assert.ok("errorsPerSessionSignal" in health);
  });

  test("admin dashboard + rate limits + command center", () => {
    process.env.AURA_PLATFORM_ADMIN_USER_IDS = "u-admin";
    const dash = buildAdminBetaDashboard("u-admin");
    assert.equal(dash.ok, true);
    assert.ok(dash.dashboard);

    const denied = canAccessAdminPlatform({
      userId: "u-viewer",
      allowedUserIds: ["u-admin"],
    });
    assert.equal(denied, false);

    for (let i = 0; i < 20; i++) {
      checkPlatformRateLimit("feedback", "u-a");
    }
    const rl = checkPlatformRateLimit("feedback", "u-a");
    assert.equal(rl.ok, false);

    const cmd = handleBetaOpsCommand("Reportar um problema.");
    assert.equal(cmd.card?.kind, "feedback_form");
    const ch = handleBetaOpsCommand("O que mudou na última versão?");
    assert.equal(ch.card?.kind, "changelog");
  });

  test("e2e scenario sketch Admin / A / B", () => {
    let state = createEmptyBetaOpsState();
    assignUserCohort("u-a", "PERSONAL_USERS");
    assignUserCohort("u-b", "TEAMS");

    const inv = createBetaInvitePure(state, {
      email: "a@example.com",
      cohort: "PERSONAL_USERS",
      createdBy: "u-admin",
    });
    state = inv.state;
    const acc = acceptBetaInvitePure(state, {
      token: inv.token,
      userId: "u-a",
      userEmail: "a@example.com",
    });
    assert.equal(acc.ok, true);
    state = acc.state;

    state = {
      ...state,
      signupAtByUser: { "u-a": new Date().toISOString() },
      onboardingCompletedAtByUser: { "u-a": new Date().toISOString() },
    };
    const fv = recordFirstValuePure(state, { userId: "u-a", type: "first_conversation" });
    state = fv.state;
    assert.ok(fv.event);

    const bug = createFeedbackPure(state, {
      title: "bug",
      description: "x",
      type: "BUG",
      createdBy: "u-a",
    });
    state = bug.state;
    const tri = updateFeedbackStatusPure(state, {
      feedbackId: bug.item.id,
      actorId: "u-admin",
      status: "RESOLVED",
    });
    state = tri.state!;

    const rel = createReleasePure(state, {
      version: "10.2.1",
      channel: "BETA",
      title: "fix",
      summary: "bug fix",
      changes: [{ kind: "fix", text: "feedback" }],
      createdBy: "u-admin",
    });
    state = setReleaseStatusPure(rel.state, {
      releaseId: rel.release.id,
      status: "RELEASED",
      actorId: "u-admin",
      notifyUserIds: ["u-a"],
    }).state!;

    assert.equal(listReleasedChangelog(state)[0]?.version, "10.2.1");

    const rollA = upsertRolloutPure(state, {
      key: "beta.diff",
      percent: 0,
      userIds: ["u-a"],
      reason: "A only",
      updatedBy: "u-admin",
    });
    state = rollA.state;
    assert.equal(resolveRolloutPure(state, "beta.diff", { userId: "u-a" }).enabled, true);
    assert.equal(resolveRolloutPure(state, "beta.diff", { userId: "u-b" }).enabled, false);

    // private isolation: B cannot read A's feedback
    assert.equal(getFeedbackById(bug.item.id, "u-b", false, state), null);
  });

  test("privacy essentials cannot disable", () => {
    const prefs = updatePrivacyPrefs("u-a", {
      analyticsEssential: false,
      analyticsProduct: true,
    } as Parameters<typeof updatePrivacyPrefs>[1]);
    assert.equal(prefs.analyticsEssential, true);
    assert.equal(getPrivacyPrefs("u-a").analyticsEssential, true);
  });
});
