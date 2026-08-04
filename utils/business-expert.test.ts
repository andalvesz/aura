/**
 * Business Expert B1.0 Foundation tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  addBusinessObjective,
  addBusinessVenture,
  adviseBusiness,
  assertNoPersonalIdentityData,
  buildBusinessContext,
  buildOverview,
  clearBusinessExpertState,
  draftBusinessPlan,
  ensureBusinessExpertRegistered,
  getBusinessExpertRegistration,
  getHomeBusinessExpertCard,
  handleBusinessExpertCommand,
  isBusinessExpertIntentMessage,
  listBusinessTypeIds,
  listDomainIds,
  listKnowledgeArticles,
  listSupportedBusinessTypes,
  parseBusinessIntent,
  runBusinessExpert,
  toCorePlanDraftProposal,
  upsertBusinessProfile,
  validateBusinessProfile,
  BUSINESS_EXPERT_CAPABILITY_ID,
  BUSINESS_EXPERT_SKILL_ID,
  BUSINESS_EXPERT_CATEGORY,
} from "@/lib/business-expert";
import {
  clearCapabilityRegistry,
  clearSkillRegistry,
  ensurePlatformRegistries,
  getCapability,
  getSkill,
  installCapabilityPure,
  installSkillPure,
  createEmptyPlatformState,
  bootstrapCoreInstallations,
  clearPlatformState,
  type ResolveContext,
} from "@/lib/capabilities";
import {
  clearLearningRegistry,
  ensureBuiltinLearningAdapters,
  isEventRegistered,
} from "@/lib/learning/registry";
import { routeConversationIntent } from "@/lib/conversation/intent-router";

function ctx(): ResolveContext {
  return {
    userId: "u-be",
    workspaceId: null,
    workspaceSlug: null,
    role: "owner",
    isWorkspaceMember: false,
    environment: "test",
  };
}

beforeEach(() => {
  clearBusinessExpertState();
  clearPlatformState();
  clearCapabilityRegistry();
  clearSkillRegistry();
  clearLearningRegistry();
  ensurePlatformRegistries();
  ensureBuiltinLearningAdapters();
});

describe("Business Expert B1.0 Foundation", () => {
  test("artifacts exist", () => {
    const root = process.cwd();
    for (const rel of [
      "lib/business-expert/registry.ts",
      "lib/business-expert/types.ts",
      "lib/business-expert/service.ts",
      "lib/business-expert/context.ts",
      "lib/business-expert/knowledge.ts",
      "lib/business-expert/advisor.ts",
      "lib/business-expert/planner.ts",
      "lib/business-expert/validators.ts",
      "lib/business-expert/business-engine.ts",
      "app/dashboard/business-expert/page.tsx",
      "docs/business-expert/foundation.md",
      "reports/business-expert-b1.0.md",
    ]) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
  });

  test("capability + skill registered with Business Intelligence category", () => {
    const reg = ensureBusinessExpertRegistered();
    assert.equal(reg.capability, true);
    assert.equal(reg.skill, true);
    assert.ok(reg.domains >= 18);
    assert.ok(reg.businessTypes >= 13);
    assert.ok(reg.marketplaces >= 13);
    assert.equal(reg.modes, 8);

    const cap = getCapability(BUSINESS_EXPERT_CAPABILITY_ID);
    const skill = getSkill(BUSINESS_EXPERT_SKILL_ID);
    assert.ok(cap);
    assert.ok(skill);
    assert.equal(cap!.name, "Business Expert");
    assert.equal(cap!.category, BUSINESS_EXPERT_CATEGORY);
    assert.equal(skill!.name, "Business Expert");
    assert.equal(skill!.category, BUSINESS_EXPERT_CATEGORY);
    assert.ok(cap!.routes.includes("/dashboard/business-expert"));

    const registration = getBusinessExpertRegistration();
    assert.equal(registration.capability?.id, BUSINESS_EXPERT_CAPABILITY_ID);
    assert.equal(registration.skill?.id, BUSINESS_EXPERT_SKILL_ID);
  });

  test("capability and skill can be installed on platform state", () => {
    let state = createEmptyPlatformState();
    state = bootstrapCoreInstallations(state, ctx());
    const cap = installCapabilityPure(state, BUSINESS_EXPERT_CAPABILITY_ID, ctx());
    assert.equal(cap.ok, true);
    state = cap.state;
    const skill = installSkillPure(state, BUSINESS_EXPERT_SKILL_ID, ctx());
    assert.equal(skill.ok, true);
  });

  test("knowledge domains and business types", () => {
    assert.ok(listDomainIds().length >= 18);
    assert.ok(listBusinessTypeIds().length >= 13);
    assert.ok(listKnowledgeArticles().length >= 10);
    assert.ok(
      listSupportedBusinessTypes().some((t) => t.id === "negocios-locais")
    );
    assert.ok(listSupportedBusinessTypes().some((t) => t.id === "saas"));
  });

  test("business profile is separate from identity and rejects personal keys", () => {
    const res = upsertBusinessProfile({
      userId: "u1",
      experience: "beginner",
      capital: "bootstrap",
      interestAreas: ["validacao", "monetizacao"],
      skills: ["vendas"],
      objectives: ["primeira receita"],
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.profile.kind, "business_profile");
    const leak = assertNoPersonalIdentityData(res.profile);
    assert.equal(leak.clean, true);

    const bad = validateBusinessProfile({
      ...res.profile,
      identityClaims: ["x"],
    } as Partial<import("@/lib/business-expert/types").BusinessProfile> & {
      identityClaims: string[];
    });
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some((i) => i.code === "personal_data_leak"));
  });

  test("context never mixes personal data", () => {
    upsertBusinessProfile({
      userId: "u1",
      experience: "intermediate",
      capital: "low",
      interestAreas: ["mercado", "vendas"],
      preferredBusinessTypes: ["agencia"],
    });
    const run = runBusinessExpert({ userId: "u1", intent: "overview" });
    assert.equal(run.context.kind, "business_context");
    assert.ok(!("identityClaims" in run.context));
    assert.ok(run.context.limitations.some((l) => /Identity/i.test(l)));
  });

  test("advisor + planner draft for core planner", () => {
    upsertBusinessProfile({
      userId: "u1",
      capital: "bootstrap",
      interestAreas: ["validacao"],
      preferredBusinessTypes: ["produto-digital"],
    });
    const run = runBusinessExpert({
      userId: "u1",
      message: "Quero validar uma ideia",
    });
    assert.equal(run.advisor.intent, "validate_idea");
    assert.ok(run.advisor.recommendations.length >= 1);
    assert.ok(run.planDraft);
    assert.equal(run.planDraft!.forCorePlanner, true);
    const core = toCorePlanDraftProposal(run.planDraft!);
    assert.equal(core.sourceKind, "manual");
    assert.ok(
      core.pipelineSteps.includes("business_expert_b1") ||
        core.pipelineSteps.includes("business_expert_b1x")
    );
    assert.ok(core.steps.length >= 3);
    assert.ok(core.title.trim().length > 0);
    assert.ok(core.objective.trim().length > 0);
    assert.ok(core.limitations.length > 0);
    assert.ok(core.successCriteria.length > 0);
  });

  test("command center intents", () => {
    const phrases = [
      "Quero abrir um negócio",
      "Quero empreender",
      "Quero ganhar dinheiro",
      "Quero validar uma ideia",
      "Quero criar uma empresa",
    ];
    for (const p of phrases) {
      assert.equal(isBusinessExpertIntentMessage(p), true);
      const cmd = handleBusinessExpertCommand(p, "u1");
      assert.equal(cmd.matched, true, p);
      assert.ok(cmd.message.length > 20, p);
      assert.equal(cmd.href, "/dashboard/business-expert");
      const intent = routeConversationIntent(p);
      assert.equal(intent.kind, "ASK_STATUS", p);
      assert.ok(
        intent.allowedHandlers.includes("business_expert") ||
          intent.confidence > 0.5,
        p
      );
    }
    assert.equal(parseBusinessIntent("Quero ganhar dinheiro"), "make_money");
  });

  test("learning adapter registered for business-expert", () => {
    assert.equal(
      isEventRegistered("business-expert", "intent:validate_idea"),
      true
    );
    assert.equal(isEventRegistered("business-expert", "profile_updated"), true);
  });

  test("home card + overview", () => {
    const overview = buildOverview("u-home");
    assert.equal(overview.version, "1.1.0");
    assert.equal(overview.category, "Business Intelligence");
    const card = getHomeBusinessExpertCard("u-home");
    assert.equal(card.title, "Business Expert");
    assert.equal(card.href, "/dashboard/business-expert");
  });

  test("objectives and ventures", () => {
    const o = addBusinessObjective({
      userId: "u1",
      kind: "validar-ideia",
      title: "Validar curso B2B",
      relatedDomains: ["validacao", "produto"],
    });
    assert.equal(o.ok, true);
    const v = addBusinessVenture({
      userId: "u1",
      name: "Curso Pilot",
      type: "produto-digital",
      status: "validating",
    });
    assert.equal(v.ok, true);
    const run = runBusinessExpert({ userId: "u1", intent: "advise" });
    assert.ok(run.context.objectives.length >= 1);
    assert.ok(run.context.ventures.length >= 1);
  });

  test("buildBusinessContext requires clean profile", () => {
    const upsert = upsertBusinessProfile({
      userId: "u2",
      experience: "advanced",
      capital: "medium",
    });
    assert.equal(upsert.ok, true);
    if (!upsert.ok) return;
    const ctxBiz = buildBusinessContext({ profile: upsert.profile });
    assert.equal(ctxBiz.userId, "u2");
    const advice = adviseBusiness("plan", ctxBiz);
    assert.ok(advice.summary.length > 10);
    const plan = draftBusinessPlan("plan", ctxBiz);
    assert.ok(plan.steps.length >= 3);
  });
});
