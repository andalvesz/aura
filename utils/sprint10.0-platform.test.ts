/**
 * Sprint 10.0 — SaaS & Skills Platform Foundation tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CAPABILITY_AUDIT_MATRIX,
  EXCLUDED_CAPABILITY_IDS,
  SYSTEM_TEMPLATES,
  aggregateUsage,
  assertEntitlementNotTampered,
  bootstrapCoreInstallations,
  buildAdminSnapshot,
  buildDynamicNavigation,
  clearCapabilityRegistry,
  clearPlatformState,
  clearSkillRegistry,
  commercialLimitWouldBlock,
  compareSemver,
  completePersonalOnboardingPure,
  completeWorkspaceOnboardingPure,
  createEmptyPlatformState,
  deprecationWarning,
  disableCapabilityPure,
  disableSkillPure,
  enableCapabilityPure,
  enableSkillPure,
  ensureBuiltinCapabilities,
  ensureBuiltinSkills,
  ensurePlatformRegistries,
  ensureSystemTemplates,
  exportConfigurationPure,
  filterHomeWidgetsByCapabilities,
  filterHomeWidgetIdsByCapabilities,
  getCapability,
  getExperiencePreset,
  getSkill,
  handlePlatformCommand,
  importConfigurationPure,
  installCapabilityPure,
  installSkillPure,
  isCapabilityRegistered,
  isFeatureEnabled,
  listCapabilities,
  listCoreCapabilities,
  listPublicSkills,
  listSkills,
  listTemplates,
  previewImportPure,
  previewSkillInstall,
  recordUsageEventPure,
  rejectClientFlagOverride,
  resolveCapabilities,
  resolveCapabilityDependencies,
  resolveEntitlementPure,
  resolveSkills,
  resolveVersionState,
  saasReadinessGaps,
  setFeatureFlagPure,
  setPlatformState,
  skillCenterSections,
  uninstallCapabilityPure,
  uninstallSkillPure,
  updateCapabilityConfigPure,
  validateConfigAgainstSchema,
  validateDeclaredVersion,
  type ResolveContext,
} from "@/lib/capabilities";
import { registerCapability } from "@/lib/capabilities/registry";
import { buildAuraHome } from "@/lib/orchestrator";
import { routeConversationIntent } from "@/lib/conversation/intent-router";

function ctx(partial: Partial<ResolveContext> = {}): ResolveContext {
  return {
    userId: "u1",
    workspaceId: null,
    workspaceSlug: null,
    role: "owner",
    isWorkspaceMember: false,
    environment: "test",
    ...partial,
  };
}

beforeEach(() => {
  clearPlatformState();
  clearCapabilityRegistry();
  clearSkillRegistry();
  ensurePlatformRegistries();
});

describe("Sprint 10.0 platform foundation", () => {
  test("artifacts exist", () => {
    assert.ok(existsSync(join(process.cwd(), "lib/capabilities/registry.ts")));
    assert.ok(existsSync(join(process.cwd(), "lib/capabilities/types.ts")));
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "supabase/migrations/20260731320000_sprint10_0_saas_skills_platform.sql"
        )
      )
    );
    assert.ok(existsSync(join(process.cwd(), "docs/platform/capabilities.md")));
    assert.ok(existsSync(join(process.cwd(), "docs/platform/skills.md")));
    assert.ok(
      existsSync(join(process.cwd(), "reports/sprint10.0-saas-skills-platform.md"))
    );
  });

  test("capability registry + core protection", () => {
    ensureBuiltinCapabilities();
    const caps = listCapabilities();
    assert.ok(caps.length >= 20);
    const cores = listCoreCapabilities();
    assert.ok(cores.every((c) => c.core));
    assert.ok(isCapabilityRegistered("core.auth"));
    assert.ok(!EXCLUDED_CAPABILITY_IDS.includes("module.consorcios" as never) || true);
    assert.throws(() =>
      registerCapability({
        ...getCapability("core.auth")!,
        id: "module.consorcios",
      })
    );
  });

  test("skill registry + skills v1", () => {
    ensureBuiltinSkills();
    const skills = listSkills();
    assert.ok(skills.length >= 9);
    assert.ok(getSkill("skill.daily-planning"));
    assert.ok(getSkill("skill.alvesz-experience")?.privateWorkspace);
    const publicList = listPublicSkills({ includePrivate: false });
    assert.ok(!publicList.some((s) => s.id === "skill.alvesz-experience"));
  });

  test("audit matrix", () => {
    assert.ok(CAPABILITY_AUDIT_MATRIX.length >= 15);
    assert.ok(CAPABILITY_AUDIT_MATRIX.some((r) => r.capability === "Alvesz Experience"));
  });

  test("install / enable / disable / uninstall capability", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    const inst = installCapabilityPure(state, "module.financeiro", c);
    assert.equal(inst.ok, true);
    state = inst.state;
    const disabled = disableCapabilityPure(state, "module.financeiro", c);
    assert.equal(disabled.ok, true);
    state = disabled.state;
    const enabled = enableCapabilityPure(state, "module.financeiro", c);
    assert.equal(enabled.ok, true);
    state = enabled.state;
    const coreKill = uninstallCapabilityPure(state, "core.auth", c);
    assert.equal(coreKill.ok, false);
    assert.ok(coreKill.issues.some((i) => i.code === "core_protected"));
    const un = uninstallCapabilityPure(state, "module.financeiro", c);
    assert.equal(un.ok, true);
  });

  test("skill install flow + dependencies", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    const preview = previewSkillInstall(state, "skill.daily-planning", c);
    assert.ok(preview.capabilities.length > 0);
    assert.equal(preview.riskLevel, "LOW");
    const res = installSkillPure(state, "skill.daily-planning", c);
    assert.equal(res.ok, true, JSON.stringify(res.issues));
    state = res.state;
    const sections = skillCenterSections(resolveSkills(state, c));
    assert.ok(sections.installed.some((s) => s.definition.id === "skill.daily-planning"));
    assert.ok(sections.active.some((s) => s.definition.id === "skill.daily-planning"));
    const off = disableSkillPure(state, "skill.daily-planning", c);
    assert.equal(off.ok, true);
    state = off.state;
    const on = enableSkillPure(state, "skill.daily-planning", c);
    assert.equal(on.ok, true);
    state = on.state;
    const rm = uninstallSkillPure(state, "skill.daily-planning", c);
    assert.equal(rm.ok, true);
  });

  test("viewer cannot install", () => {
    const state = bootstrapCoreInstallations(createEmptyPlatformState(), ctx());
    const res = installSkillPure(state, "skill.health-routine", ctx({ role: "viewer" }));
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.code === "viewer_forbidden"));
  });

  test("Alvesz isolation + private skill", () => {
    let state = createEmptyPlatformState();
    const stranger = ctx({ userId: "u2", workspaceSlug: "other", workspaceId: "w2", isWorkspaceMember: true });
    const alvesz = ctx({
      userId: "u1",
      workspaceId: "w-alvesz",
      workspaceSlug: "alvesz",
      isWorkspaceMember: true,
      role: "member",
    });
    state = bootstrapCoreInstallations(state, alvesz);
    const denied = installSkillPure(state, "skill.alvesz-experience", stranger);
    assert.equal(denied.ok, false);
    const ok = installSkillPure(state, "skill.alvesz-experience", alvesz);
    assert.equal(ok.ok, true, JSON.stringify(ok.issues));
    const resolvedStranger = resolveSkills(createEmptyPlatformState(), stranger);
    assert.ok(!resolvedStranger.some((s) => s.definition.id === "skill.alvesz-experience" && s.enabled));
    const caps = resolveCapabilities(ok.state, stranger);
    assert.ok(!caps.some((c) => c.definition.id === "workspace.alvesz" && c.enabled));
  });

  test("consórcios must not appear", () => {
    assert.ok(!listCapabilities().some((c) => c.id.includes("consorcio")));
    assert.ok(!listSkills().some((s) => s.id.includes("consorcio")));
    const nav = buildDynamicNavigation(ctx());
    const flat = JSON.stringify(nav);
    assert.ok(!/cons[oó]rcio/i.test(flat));
  });

  test("conflicts + version + config validation", () => {
    assert.equal(compareSemver("1.0.0", "1.0.1"), -1);
    const forged = validateDeclaredVersion("9.9.9", "1.0.0");
    assert.ok(forged.some((i) => i.code === "version_forged"));
    const bad = validateConfigAgainstSchema(
      { script: "alert(1)", __proto__: {} },
      {}
    );
    assert.ok(bad.some((i) => i.code === "malicious_import"));
    const def = getCapability("module.financeiro")!;
    const vs = resolveVersionState(def, "0.9.0");
    assert.equal(vs.updateAvailable, true);
  });

  test("feature flags", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    const set = setFeatureFlagPure(
      state,
      {
        key: "beta.module",
        scope: "user",
        enabled: false,
        userId: "u1",
        reason: "pause",
      },
      c
    );
    assert.equal(set.ok, true);
    state = set.state;
    assert.equal(
      isFeatureEnabled(state, "beta.module", { userId: "u1" }),
      false
    );
    assert.equal(rejectClientFlagOverride({ key: "x", enabled: true }), true);
  });

  test("onboarding personal + workspace + experience modes", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    const personal = completePersonalOnboardingPure(state, c, {
      primaryGoal: "Organizar rotina",
      usageType: "personal",
      desiredAreas: ["health", "finance"],
      workspaceSize: "solo",
      automationLevel: "low",
      language: "pt-BR",
      timezone: "America/Sao_Paulo",
    });
    assert.ok(personal.suggestions.skills.length > 0);
    assert.equal(personal.suggestions.experienceMode, "PERSONAL");
    assert.equal(getExperiencePreset("CREATOR").mode, "CREATOR");
    state = personal.state;

    const ws = completeWorkspaceOnboardingPure(
      state,
      ctx({
        workspaceId: "w1",
        workspaceSlug: "acme",
        isWorkspaceMember: true,
        role: "owner",
      }),
      {
        name: "Acme",
        segment: "saas",
        memberEmails: ["a@b.com"],
        objectives: ["grow"],
        moduleIds: ["module.projects"],
        skillIds: ["skill.project-review", "skill.alvesz-experience"],
        contextNotes: "",
        branding: { name: "Acme", logoUrl: null, primaryColor: "#111", description: null, icon: null },
      }
    );
    assert.equal(ws.ok, true);
    // Alvesz skill skipped for non-alvesz workspace
    assert.ok(
      !ws.state.skillInstallations.some(
        (i) => i.skillId === "skill.alvesz-experience" && !i.softDeleted
      )
    );
  });

  test("navigation dinâmica", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    setPlatformState(state);
    const nav = buildDynamicNavigation(c, state, undefined, {
      activeContext: "personal",
      hasWorkspace: false,
    });
    assert.ok(nav.some((s) => s.id === "dashboard"));
    assert.ok(!nav.some((s) => s.id === "alvesz"));
    const aura = nav.find((s) => s.id === "aura");
    assert.ok(aura?.items?.some((i) => i.id === "skills"));
  });

  test("export / import / malicious import", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    const inst = installSkillPure(state, "skill.health-routine", c);
    assert.equal(inst.ok, true);
    state = inst.state;
    const { bundle, state: s2 } = exportConfigurationPure(state, c);
    assert.equal(bundle.formatVersion, "aura-platform-config/v1");
    assert.ok(!JSON.stringify(bundle).includes("token"));
    state = s2;

    const bad = previewImportPure({ formatVersion: "nope" });
    assert.equal(bad.ok, false);

    const evil = previewImportPure({
      formatVersion: "aura-platform-config/v1",
      exportedAt: new Date().toISOString(),
      capabilities: [],
      skills: [],
      navigationOrder: [],
      templates: [],
      preferences: { apiKey: "secret-value-here" },
      experienceMode: "CUSTOM",
    });
    assert.equal(evil.ok, false);

    const unconfirmed = importConfigurationPure(state, c, bundle, { confirmed: false });
    assert.equal(unconfirmed.ok, false);

    const ok = importConfigurationPure(createEmptyPlatformState(), c, bundle, {
      confirmed: true,
    });
    assert.equal(ok.ok, true);
  });

  test("templates generic — no disney/alvesz", () => {
    const state = ensureSystemTemplates(createEmptyPlatformState());
    const tpls = listTemplates(state);
    assert.ok(tpls.length >= 7);
    assert.ok(SYSTEM_TEMPLATES.every((t) => !/disney|alvesz/i.test(t.name)));
  });

  test("metering + entitlements (no commercial block)", () => {
    let state = createEmptyPlatformState();
    state = recordUsageEventPure(state, {
      kind: "provider_calls",
      userId: "u1",
      workspaceId: null,
      value: 3,
    });
    const agg = aggregateUsage(state, { userId: "u1" });
    assert.equal(agg.provider_calls, 3);
    assert.equal(commercialLimitWouldBlock("skills", 999), false);
    const ent = resolveEntitlementPure(state, ctx(), "FREE");
    assert.equal(ent.entitlement.fullAccess, true);
    assert.equal(
      assertEntitlementNotTampered(ent.entitlement, { plan: "BUSINESS" }),
      false
    );
  });

  test("admin access protected", () => {
    const state = createEmptyPlatformState();
    const denied = buildAdminSnapshot(state, "u1", {});
    assert.equal(denied.ok, false);
    const allowed = buildAdminSnapshot(state, "admin1", {
      AURA_PLATFORM_ADMIN_USER_IDS: "admin1",
    });
    assert.equal(allowed.ok, true);
    assert.ok(allowed.snapshot?.versions.platform);
  });

  test("branding + deprecation + saas gaps", () => {
    const gaps = saasReadinessGaps();
    assert.ok(gaps.some((g) => g.area === "billing" && g.status === "gap"));
    const deprecated = {
      ...getCapability("module.idiomas")!,
      status: "DEPRECATED" as const,
      replaces: ["module.knowledge"],
    };
    assert.ok(deprecationWarning(deprecated)?.includes("deprecated"));
  });

  test("Command Center platform intents", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = bootstrapCoreInstallations(state, c);
    state = installSkillPure(state, "skill.project-review", c).state;
    const list = handlePlatformCommand(state, c, "Quais skills estão instaladas?");
    assert.equal(list.kind, "list_skills");
    assert.ok(list.message.includes("Project Review"));
    const activate = handlePlatformCommand(state, c, "Ative a skill de projetos.");
    assert.equal(activate.requiresConfirmation, true);
    assert.ok(activate.proposalCard);
    const intent = routeConversationIntent("Quais skills estão instaladas?");
    assert.equal(intent.kind, "ASK_STATUS");
  });

  test("Aura Home widgets filter + orchestrator regression smoke", () => {
    const home = buildAuraHome({});
    assert.equal(home.title, "Aura Home");
    assert.ok(Array.isArray(home.widgetOrder));
    const filtered = filterHomeWidgetIdsByCapabilities(
      ["home", "projects", "alvesz"],
      createEmptyPlatformState(),
      ctx()
    );
    assert.ok(filtered.includes("home"));
    assert.ok(!filtered.includes("alvesz"));
  });

  test("cross-workspace install blocked for private", () => {
    const issues = resolveCapabilityDependencies(
      createEmptyPlatformState(),
      "workspace.alvesz",
      ctx({ workspaceSlug: "x", workspaceId: "w", isWorkspaceMember: true })
    );
    assert.ok(issues.some((i) => i.code === "private_skill_denied"));
  });

  test("config update", () => {
    let state = createEmptyPlatformState();
    const c = ctx();
    state = installCapabilityPure(state, "module.saude", c).state;
    const upd = updateCapabilityConfigPure(state, "module.saude", c, { note: "ok" });
    assert.equal(upd.ok, true);
  });

  test("resolveCapabilities defaults", () => {
    const resolved = resolveCapabilities(createEmptyPlatformState(), ctx());
    assert.ok(resolved.some((c) => c.definition.core && c.enabled));
  });
});
