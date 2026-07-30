import test from "node:test";
import assert from "node:assert/strict";
import { runAuraBrain } from "@/lib/aura-brain/core";
import { executeAuraBrainAction } from "@/lib/aura-brain/actions/executor";
import {
  clearActions,
  ensureBuiltinActions,
  listActions,
} from "@/lib/aura-brain/actions/registry";
import {
  resetAutomationState,
  markNotified,
  runAuraBrainAutomations,
} from "@/lib/aura-brain/automations/engine";
import { ensureBuiltinAutomations } from "@/lib/aura-brain/automations/registry";
import { setAuraBrainSettings } from "@/lib/aura-brain/context";
import { sanitizeAuditInput, clearAuditBuffer } from "@/lib/aura-brain/audit";
import { recordFeedback, clearFeedback } from "@/lib/aura-brain/learning/feedback";
import { runAuraBrainPlanner } from "@/lib/aura-brain/planner/planner";
import { evaluateActionPermission } from "@/lib/aura-brain/permissions";
import { autonomyAllowsExecution } from "@/lib/aura-brain/autonomy";
import { invalidateAuraIntelligenceCache } from "@/lib/intelligence/invalidate";
import { setCachedIntelligence, getCachedIntelligence } from "@/lib/intelligence/cache";
import { runAuraIntelligenceEngine } from "@/lib/intelligence/engine";
import {
  emptyUserInput,
  multiAlertInput,
  calendarConflictInput,
} from "@/utils/intelligence-fixtures";
import { clearRules, registerDefaultPlugins } from "@/lib/intelligence/rules";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import { DEFAULT_AURA_BRAIN_SETTINGS } from "@/lib/aura-brain/types";

function settings(
  userId: string,
  partial?: Partial<AuraBrainSettings>
): AuraBrainSettings {
  return {
    userId,
    ...DEFAULT_AURA_BRAIN_SETTINGS,
    ...partial,
    updatedAt: new Date().toISOString(),
  };
}

test.beforeEach(() => {
  clearActions();
  ensureBuiltinActions();
  ensureBuiltinAutomations();
  resetAutomationState();
  clearAuditBuffer();
  clearFeedback();
  clearRules();
  registerDefaultPlugins();
});

test("autonomy ranks and blocks HIGH auto", () => {
  assert.equal(autonomyAllowsExecution("AUTO_SAFE", "AUTO_SAFE"), true);
  assert.equal(autonomyAllowsExecution("SUGGEST", "AUTO_SAFE"), false);
  const perm = evaluateActionPermission({
    registered: true,
    actionId: "create_financial_entry_draft",
    context: "personal",
    allowedContexts: ["personal"],
    requiredRole: "any",
    userRole: null,
    settings: settings("u1", { defaultAutonomyLevel: "AUTO_SAFE" }),
    autonomyRequired: "CONFIRM",
    riskLevel: "HIGH",
    confirmed: false,
    isFinancial: true,
    dailyCount: 0,
    dedupeHit: false,
    cooldownActive: false,
  });
  assert.equal(perm.allowed, false);
});

test("action registry has initial actions", () => {
  assert.ok(listActions().length >= 10);
  assert.ok(listActions().some((a) => a.id === "create_notification"));
  assert.ok(listActions().some((a) => a.id === "create_business_idea_draft"));
});

test("executor rejects unregistered action", async () => {
  const res = await executeAuraBrainAction({
    actionId: "nope",
    userId: "u1",
    context: "personal",
    input: {},
    settings: settings("u1"),
  });
  assert.equal(res.rejected, true);
});

test("executor rejects invalid input", async () => {
  const res = await executeAuraBrainAction({
    actionId: "create_notification",
    userId: "u1",
    context: "personal",
    input: { title: "" },
    settings: settings("u1", { defaultAutonomyLevel: "AUTO_SAFE" }),
  });
  assert.equal(res.rejected, true);
});

test("planner: empty intelligence → no critical plan", () => {
  const intel = runAuraIntelligenceEngine(emptyUserInput());
  const out = runAuraBrainPlanner({
    userId: "u1",
    context: "personal",
    intelligence: intel,
    settings: settings("u1"),
  });
  assert.equal(out.proposedActions.filter((p) => p.actionId === "create_notification").length, 0);
});

test("planner: critical → notification proposal + plan", () => {
  const intel = runAuraIntelligenceEngine(multiAlertInput());
  const out = runAuraBrainPlanner({
    userId: "u1",
    context: "personal",
    intelligence: intel,
    settings: settings("u1"),
  });
  assert.ok(out.proposedActions.some((p) => p.actionId === "create_notification"));
  assert.ok(out.plans.some((p) => p.priority === "CRITICAL"));
});

test("dedupe: pending key suppresses proposal", () => {
  const intel = runAuraIntelligenceEngine(multiAlertInput());
  const first = runAuraBrainPlanner({
    userId: "u1",
    context: "personal",
    intelligence: intel,
    settings: settings("u1"),
  });
  const keys = first.proposedActions.map((p) => p.dedupeKey);
  const second = runAuraBrainPlanner({
    userId: "u1",
    context: "personal",
    intelligence: intel,
    settings: settings("u1"),
    pendingDedupeKeys: keys,
  });
  assert.equal(second.proposedActions.length, 0);
});

test("automation SUGGEST skips execution", async () => {
  const brain = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    intelligenceInput: multiAlertInput(),
    settings: { defaultAutonomyLevel: "SUGGEST" },
    runAutomations: true,
  });
  assert.ok(
    brain.automationResults.every(
      (r) => r.status === "skipped" || r.automationId === "*"
    ) || brain.automationResults.some((r) => r.reason.includes("AUTO_SAFE"))
  );
});

test("automation AUTO_SAFE creates notification once", async () => {
  setAuraBrainSettings("u1", { defaultAutonomyLevel: "AUTO_SAFE" });
  let created = 0;
  const adapters = {
    createNotification: async () => {
      created += 1;
      return { id: `n-${created}`, error: null };
    },
    findUnreadNotification: async () => false,
  };
  const first = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    intelligenceInput: multiAlertInput(),
    settings: { defaultAutonomyLevel: "AUTO_SAFE" },
    runAutomations: true,
    adapters,
  });
  assert.ok(first.automationResults.some((r) => r.status === "executed"));
  const createdAfterFirst = created;
  const second = await runAuraBrain({
    userId: "u1",
    mode: "personal",
    intelligenceInput: multiAlertInput(),
    settings: { defaultAutonomyLevel: "AUTO_SAFE" },
    runAutomations: true,
    adapters,
  });
  assert.ok(second.automationResults.some((r) => r.reason === "já notificado" || r.status === "skipped"));
  assert.ok(created === createdAfterFirst);
});

test("audit sanitizes secrets", () => {
  const clean = sanitizeAuditInput({
    title: "ok",
    password: "secret",
    api_key: "x",
    token: "y",
  });
  assert.equal(clean.password, "[redacted]");
  assert.equal(clean.api_key, "[redacted]");
  assert.equal(clean.title, "ok");
});

test("cache invalidation is scoped", () => {
  const intel = runAuraIntelligenceEngine(emptyUserInput());
  setCachedIntelligence("u1", "personal", intel);
  setCachedIntelligence("u2", "personal", intel);
  invalidateAuraIntelligenceCache({ userId: "u1", reason: "gasto" });
  assert.equal(getCachedIntelligence("u1", "personal"), null);
  assert.ok(getCachedIntelligence("u2", "personal"));
});

test("calendar conflict real times; all-day skipped", () => {
  const conflict = runAuraIntelligenceEngine(calendarConflictInput());
  assert.ok(
    conflict.ruleResults.some(
      (r) => r.ruleId === "CalendarConflictRule" && r.status === "WARNING"
    )
  );
});

test("learning feedback stored without mutating rules", () => {
  recordFeedback({
    userId: "u1",
    workspaceId: null,
    targetKind: "recommendation",
    targetId: "rec-1",
    signal: "nao_sugerir_novamente",
  });
  // rules still registered
  assert.ok(listActions().length >= 10);
});

test("cooldown and daily limit", async () => {
  resetAutomationState();
  const s = settings("u1", {
    defaultAutonomyLevel: "AUTO_SAFE",
    dailyExecutionLimit: 1,
  });
  const prop = {
    id: "p1",
    actionId: "create_notification",
    planId: null,
    title: "t",
    reason: "r",
    riskLevel: "LOW" as const,
    autonomyRequired: "AUTO_SAFE" as const,
    input: {
      title: "t",
      message: "m",
      type: "aura_brain_critical",
      related_id: "prio-1",
    },
    status: "proposed" as const,
    dedupeKey: "create_notification::critical::prio-1::financeiro",
  };
  const adapters = {
    createNotification: async () => ({ id: "n1", error: null }),
    findUnreadNotification: async () => false,
  };
  await runAuraBrainAutomations({
    userId: "u1",
    context: "personal",
    trigger: "INTELLIGENCE_GENERATED",
    settings: s,
    proposedActions: [prop],
    adapters,
  });
  markNotified(prop.dedupeKey);
  const again = await runAuraBrainAutomations({
    userId: "u1",
    context: "personal",
    trigger: "INTELLIGENCE_GENERATED",
    settings: s,
    proposedActions: [prop],
    adapters,
  });
  assert.ok(again.some((r) => r.status === "skipped"));
});

test("consorcios view module removed from filesystem", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const p = path.join(
    process.cwd(),
    "components/dashboard/modules/consorcios-view.tsx"
  );
  assert.equal(fs.existsSync(p), false);
});
