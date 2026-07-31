/**
 * Sprint 10.1 — Public Beta & Production Readiness tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  BETA_FEATURE_FLAGS,
  advanceOnboardingStepPure,
  bootstrapCoreInstallations,
  buildDynamicNavigation,
  buildPlatformHealth,
  canAccessBeta,
  checkPlatformRateLimit,
  clearBetaAccessStore,
  clearCapabilityRegistry,
  clearPlatformObservability,
  clearPlatformRateLimits,
  clearPlatformState,
  clearPrivacyStores,
  clearSkillRegistry,
  completeOnboardingV2Pure,
  createEmptyPlatformState,
  createOnboardingV2Progress,
  ensureBetaActive,
  ensureBetaFeatureFlags,
  ensurePlatformRegistries,
  exportAccountDataPure,
  getPrivacyPrefs,
  installSkillPure,
  inviteBetaUser,
  isMemoryPlatformPersistence,
  listBetaAccessAggregated,
  reactivateBetaAccess,
  recordPlatformEvent,
  requestAccountDeletionPure,
  resolvePlatformPersistenceMode,
  resumeOnboardingFromState,
  suspendBetaAccess,
  updatePrivacyPrefs,
  type ResolveContext,
} from "@/lib/capabilities";
import { resolvePublicSiteUrl, isLocalhostUrl } from "@/lib/site-url";

function ctx(partial: Partial<ResolveContext> = {}): ResolveContext {
  return {
    userId: "u-beta-1",
    workspaceId: null,
    workspaceSlug: null,
    role: "owner",
    isWorkspaceMember: false,
    environment: "test",
    ...partial,
  };
}

beforeEach(() => {
  process.env.AURA_PLATFORM_PERSISTENCE = "memory";
  clearPlatformState();
  clearCapabilityRegistry();
  clearSkillRegistry();
  clearBetaAccessStore();
  clearPrivacyStores();
  clearPlatformRateLimits();
  clearPlatformObservability();
  ensurePlatformRegistries();
});

describe("Sprint 10.1 public beta readiness", () => {
  test("artifacts + migration order docs", () => {
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "supabase/migrations/20260731330000_sprint10_1_public_beta_readiness.sql"
        )
      )
    );
    assert.ok(existsSync(join(process.cwd(), "docs/operations/migration-order.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/operations/public-beta-go-live.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/operations/backup-recovery.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/beta-access.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/onboarding-v2.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/privacy-center.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/platform-health.md")));
    assert.ok(
      existsSync(join(process.cwd(), "reports/sprint10.1-public-beta-readiness.md"))
    );
    assert.ok(existsSync(join(process.cwd(), "types/platform-database.ts")));
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/error.tsx")));
    assert.ok(existsSync(join(process.cwd(), "app/dashboard/settings/privacy/page.tsx")));
    assert.ok(existsSync(join(process.cwd(), "app/legal/termos/page.tsx")));
  });

  test("persistence mode — memory for tests", () => {
    assert.equal(resolvePlatformPersistenceMode({ NODE_ENV: "test" }), "memory");
    assert.equal(isMemoryPlatformPersistence({ NODE_ENV: "test" }), true);
    assert.equal(
      resolvePlatformPersistenceMode({ AURA_PLATFORM_PERSISTENCE: "supabase" }),
      "supabase"
    );
  });

  test("onboarding v2 resume + complete without AUTO_SAFE / mock data", () => {
    let state = bootstrapCoreInstallations(createEmptyPlatformState(), ctx());
    let progress = createOnboardingV2Progress();
    recordPlatformEvent({ event: "onboarding_started", userId: "u-beta-1" });

    let step = advanceOnboardingStepPure(state, ctx(), progress, 2, {
      usageType: "personal",
    });
    assert.equal(step.ok, true);
    state = step.state;
    progress = step.progress;

    step = advanceOnboardingStepPure(state, ctx(), progress, 4, {
      experienceMode: "PERSONAL",
      primaryGoal: "Organizar rotina",
    });
    state = step.state;
    progress = step.progress;

    const done = completeOnboardingV2Pure(state, ctx(), progress, {
      installSelectedSkills: true,
    });
    assert.equal(done.progress.completed, true);
    assert.equal(done.progress.firstValueChecklist.configureAura, true);
    assert.ok(done.state.onboardingByUser["u-beta-1"]?.completed);

    const resumed = resumeOnboardingFromState(done.state, "u-beta-1");
    assert.equal(resumed.completed, true);
  });

  test("experience modes + skill install + navigation", () => {
    let state = bootstrapCoreInstallations(createEmptyPlatformState(), ctx());
    const inst = installSkillPure(state, "skill.daily-planning", ctx());
    assert.equal(inst.ok, true);
    state = inst.state;
    const nav = buildDynamicNavigation(ctx(), state);
    assert.ok(nav.some((s) => s.id === "dashboard"));
  });

  test("beta access — current users ACTIVE; suspend/reactivate", () => {
    const active = ensureBetaActive("u-beta-1");
    assert.equal(active.accessStatus, "ACTIVE");
    assert.equal(canAccessBeta("u-beta-1"), true);
    inviteBetaUser("u-invited", "cohort_a");
    const sus = suspendBetaAccess("admin", "u-beta-1", "test");
    assert.equal(sus.ok, true);
    assert.equal(canAccessBeta("u-beta-1"), false);
    reactivateBetaAccess("u-beta-1");
    assert.equal(canAccessBeta("u-beta-1"), true);
    const agg = listBetaAccessAggregated();
    assert.ok(agg.total >= 2);
  });

  test("feature flags beta + health", () => {
    let state = createEmptyPlatformState();
    state = ensureBetaFeatureFlags(state, ctx(), "test");
    for (const key of BETA_FEATURE_FLAGS) {
      assert.ok(state.featureFlags.some((f) => f.key === key));
    }
    const health = buildPlatformHealth({
      supabaseReachable: true,
      authOk: true,
      recentErrorRate: 0.01,
    });
    assert.ok(["HEALTHY", "DEGRADED", "UNKNOWN"].includes(health.overall));
  });

  test("privacy + export + deletion request confirmation", () => {
    let state = createEmptyPlatformState();
    const prefs = updatePrivacyPrefs("u-beta-1", { learningEnabled: false });
    assert.equal(prefs.learningEnabled, false);
    assert.equal(getPrivacyPrefs("u-beta-1").learningEnabled, false);

    const exp = exportAccountDataPure(state, ctx());
    assert.equal(exp.bundle.formatVersion, "aura-account-export/v1");
    assert.ok(!JSON.stringify(exp.bundle).includes("password"));

    const bad = requestAccountDeletionPure(exp.state, ctx(), {
      reason: "test",
      confirmPhrase: "nope",
    });
    assert.equal(bad.ok, false);

    const ok = requestAccountDeletionPure(exp.state, ctx(), {
      reason: "test",
      confirmPhrase: "EXCLUIR MINHA CONTA",
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.request?.status, "REVIEW");
  });

  test("rate limit foundation", () => {
    clearPlatformRateLimits();
    let blocked = false;
    for (let i = 0; i < 50; i++) {
      const r = checkPlatformRateLimit("skill_install", "u-rate");
      if (!r.ok) {
        blocked = true;
        assert.ok(r.message);
        break;
      }
    }
    assert.equal(blocked, true);
  });

  test("auth site url — no localhost in production resolve", () => {
    assert.equal(isLocalhostUrl("http://localhost:3000"), true);
    const url = resolvePublicSiteUrl({
      requestOrigin: "https://aura-ten-rose.vercel.app",
    });
    assert.ok(url.startsWith("https://"));
    assert.equal(isLocalhostUrl(url), false);
  });

  test("platform regression — core still protected", async () => {
    const { uninstallCapabilityPure } = await import("@/lib/capabilities");
    const state = bootstrapCoreInstallations(createEmptyPlatformState(), ctx());
    const res = uninstallCapabilityPure(state, "core.auth", ctx());
    assert.equal(res.ok, false);
  });

  test("observability events recorded", async () => {
    recordPlatformEvent({
      event: "home_loaded",
      userId: "u-beta-1",
      durationMs: 12,
      metadata: { token: "should-strip" },
    });
    const { listPlatformEvents } = await import("@/lib/capabilities");
    const events = listPlatformEvents(5);
    assert.ok(events.some((e) => e.event === "home_loaded"));
  });
});
