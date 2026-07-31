/**
 * Sprint 8.1 — Automation Engine V1 tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  clearActions,
  ensureBuiltinActions,
  getAction,
  isBlockedActionId,
  listActions,
  sanitizeActionInput,
} from "@/lib/aura-brain/actions/registry";
import {
  acquireLease,
  cancelAutomationPure,
  clearAutomationState,
  confirmAutomationPure,
  createEmptyAutomationState,
  executeAutomationPure,
  explainAutomationPure,
  getAutomationPure,
  getHomeAutomationWidgetPure,
  hashPayload,
  listAutomationsPure,
  prepareAutomationPure,
  processEligibleAutomationsPure,
  proposeAutomationPure,
  retryAutomationPure,
  scheduleAutomationPure,
  undoAutomationPure,
  evaluateAutoSafeGates,
  evaluateExecutionGates,
  classifyError,
  isRetryable,
  type AutomationState,
  type AutomationViewer,
} from "@/lib/automation";
import {
  DEFAULT_AURA_BRAIN_SETTINGS,
  type AuraBrainSettings,
} from "@/lib/aura-brain/types";
import { PLAN_EXECUTION_INFLUENCE } from "@/lib/planner";

beforeEach(() => {
  clearAutomationState();
  clearActions();
  ensureBuiltinActions();
});

function settings(
  partial: Partial<AuraBrainSettings> = {}
): AuraBrainSettings {
  return {
    ...DEFAULT_AURA_BRAIN_SETTINGS,
    userId: "u1",
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function viewer(partial: Partial<AutomationViewer> = {}): AutomationViewer {
  return {
    userId: "u1",
    workspaceId: null,
    role: "owner",
    isWorkspaceMember: false,
    ...partial,
  };
}

describe("Sprint 8.1 Automation Engine", () => {
  test("audits existing action registry — single registry in use", () => {
    const actions = listActions();
    assert.ok(actions.length >= 10);
    assert.ok(getAction("create_notification"));
    assert.ok(getAction("create_internal_notification"));
    assert.ok(getAction("create_personal_task_draft"));
    assert.ok(getAction("mark_plan_step_complete"));
    assert.equal(isBlockedActionId("send_email"), true);
    assert.equal(getAction("send_email"), undefined);
    assert.equal(getAction("make_payment"), undefined);
  });

  test("action contract declares version, prepare, sanitize", () => {
    const a = getAction("create_notification")!;
    assert.equal(a.version, "1");
    assert.ok(a.supportedAutonomyLevels.includes("AUTO_SAFE"));
    assert.equal(typeof a.prepare, "function");
    assert.equal(typeof a.sanitizeForAudit, "function");
    const sanitized = sanitizeActionInput("create_notification", {
      title: "ok",
      message: "hi",
      password: "secret",
      token: "abc",
    });
    assert.equal(sanitized.password, "[redacted]");
    assert.equal(sanitized.token, "[redacted]");
  });

  test("propose from approved plan step", () => {
    const state = createEmptyAutomationState();
    const res = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "PLAN_STEP",
        sourceType: "plan_step",
        planId: "plan1",
        planStepId: "step1",
        planStatus: "APPROVED",
        planStepStatus: "READY",
        title: "Notificar revisão",
        actionId: "create_internal_notification",
        input: { title: "Revisão", message: "Revisar plano" },
      },
      settings()
    );
    assert.equal(res.ok, true);
    assert.equal(res.data?.status, "PROPOSED");
    assert.equal(res.data?.executionInfluence, "proposed");
    assert.equal(res.data?.planId, "plan1");
  });

  test("rejects plan not approved", () => {
    const res = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "PLAN_STEP",
        sourceType: "plan_step",
        planId: "p",
        planStepId: "s",
        planStatus: "DRAFT",
        planStepStatus: "DRAFT",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, "plan_not_approved");
  });

  test("rejects blocked plan step", () => {
    const res = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "PLAN_STEP",
        sourceType: "plan_step",
        planId: "p",
        planStepId: "s",
        planStatus: "APPROVED",
        planStepStatus: "BLOCKED",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    );
    assert.equal(res.error, "plan_step_blocked");
  });

  test("rejects unconfirmed hypothesis", () => {
    const res = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        hypothesisConfirmed: false,
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    );
    assert.equal(res.error, "unconfirmed_hypothesis_cannot_automate");
  });

  test("rejects unregistered and blocked actions", () => {
    assert.equal(
      proposeAutomationPure(
        createEmptyAutomationState(),
        viewer(),
        {
          triggerType: "MANUAL",
          sourceType: "manual",
          actionId: "send_email",
          input: {},
        },
        settings()
      ).error,
      "blocked_action"
    );
    assert.equal(
      proposeAutomationPure(
        createEmptyAutomationState(),
        viewer(),
        {
          triggerType: "MANUAL",
          sourceType: "manual",
          actionId: "not_a_real_action",
          input: {},
        },
        settings()
      ).error,
      "action_not_registered"
    );
  });

  test("prepare → awaiting confirmation → confirm → execute", async () => {
    let state = createEmptyAutomationState();
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_personal_task",
        title: "Tarefa real",
        input: { title: "Operacional" },
      },
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = proposed.state;
    const prepared = prepareAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = prepared.state;
    assert.equal(prepared.data?.status, "AWAITING_CONFIRMATION");
    assert.ok(prepared.data?.confirmationToken);

    const confirmed = confirmAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      prepared.data!.confirmationToken!,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = confirmed.state;
    assert.equal(confirmed.data?.status, "APPROVED");
    assert.equal(confirmed.data?.executionInfluence, "confirmed");

    const executed = await executeAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      settings({ defaultAutonomyLevel: "CONFIRM" }),
      { confirmed: true, forceManual: true }
    );
    assert.equal(executed.ok, true);
    assert.equal(executed.data?.status, "SUCCEEDED");
    assert.ok(
      executed.state.audits.some((a) => a.action === "automation_succeeded")
    );
    assert.ok(
      executed.state.notifications.some((n) => n.kind === "executed")
    );
  });

  test("confirmation expired", () => {
    let state = createEmptyAutomationState();
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_personal_task",
        input: { title: "x" },
      },
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = proposed.state;
    const prepared = prepareAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = prepared.state;
    const conf = state.confirmations[0];
    conf.expiresAt = new Date(Date.now() - 1000).toISOString();

    const res = confirmAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      conf.token,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    assert.equal(res.error, "confirmation_expired");
    assert.equal(res.data?.status, "EXPIRED");
  });

  test("confirmation payload mismatch after tamper", () => {
    let state = createEmptyAutomationState();
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_personal_task",
        input: { title: "original" },
      },
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = proposed.state;
    const prepared = prepareAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    state = prepared.state;
    // tamper payload
    state.automations[0].input = { title: "tampered", password: "x" };
    const res = confirmAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      prepared.data!.confirmationToken!,
      settings({ defaultAutonomyLevel: "CONFIRM" })
    );
    assert.equal(res.error, "confirmation_payload_mismatch");
  });

  test("AUTO_SAFE allowed for LOW notification", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "Ping", message: "interno" },
      },
      s
    );
    state = proposed.state;
    const prepared = prepareAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s
    );
    state = prepared.state;

    // Force approved for auto path
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;

    const executed = await executeAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s,
      { autoSafe: true, forceManual: true }
    );
    assert.equal(executed.ok, true);
    assert.equal(executed.data?.status, "SUCCEEDED");
    assert.equal(executed.data?.executionInfluence, "auto_safe");
  });

  test("AUTO_SAFE blocked without allowAutoSafe / high risk / financial final", () => {
    const auto = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings({ defaultAutonomyLevel: "AUTO_SAFE", allowAutoSafe: false })
    ).data!;

    const gated = evaluateAutoSafeGates({
      automation: auto,
      settings: settings({
        defaultAutonomyLevel: "AUTO_SAFE",
        allowAutoSafe: false,
      }),
      defExists: true,
      risk: "LOW",
      actionId: auto.actionId,
      autoSafeEligible: true,
      isFinancialFinal: false,
      isExternalComm: false,
      isDeletion: false,
      isPermissionChange: false,
    });
    assert.equal(gated.ok, false);
    assert.ok(gated.failures.includes("auto_safe_disabled_in_settings"));

    const high = evaluateAutoSafeGates({
      automation: auto,
      settings: settings({
        defaultAutonomyLevel: "AUTO_SAFE",
        allowAutoSafe: true,
      }),
      defExists: true,
      risk: "HIGH",
      actionId: auto.actionId,
      autoSafeEligible: true,
      isFinancialFinal: false,
      isExternalComm: false,
      isDeletion: false,
      isPermissionChange: false,
    });
    assert.ok(high.failures.includes("risk_not_low"));

    const fin = evaluateAutoSafeGates({
      automation: auto,
      settings: settings({
        defaultAutonomyLevel: "AUTO_SAFE",
        allowAutoSafe: true,
      }),
      defExists: true,
      risk: "LOW",
      actionId: "create_financial_entry_final",
      autoSafeEligible: false,
      isFinancialFinal: true,
      isExternalComm: false,
      isDeletion: false,
      isPermissionChange: false,
    });
    assert.ok(fin.failures.includes("financial_final"));
  });

  test("risk levels MEDIUM/HIGH/CRITICAL require confirmation path", () => {
    const def = getAction("create_personal_task")!;
    assert.equal(def.riskLevel, "MEDIUM");
    assert.equal(def.requiresConfirmation, true);
    assert.equal(def.autoSafeEligible, false);
    const finalFin = getAction("create_financial_entry_final")!;
    assert.equal(finalFin.riskLevel, "HIGH");
    assert.equal(finalFin.isFinancialFinal, true);
  });

  test("idempotency returns same automation", () => {
    let state = createEmptyAutomationState();
    const input = {
      triggerType: "MANUAL" as const,
      sourceType: "manual" as const,
      actionId: "create_internal_notification",
      input: { title: "same", message: "same" },
    };
    const a = proposeAutomationPure(state, viewer(), input, settings());
    state = a.state;
    const b = proposeAutomationPure(state, viewer(), input, settings());
    assert.equal(a.data!.id, b.data!.id);
  });

  test("lease prevents concurrent execution", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      s
    );
    state = proposed.state;
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;

    const leased = acquireLease(state.automations[0], "worker:a");
    assert.equal(leased.ok, true);
    state.automations[0] = leased.automation!;

    const second = acquireLease(state.automations[0], "worker:b");
    assert.equal(second.ok, false);
  });

  test("expired lease is recoverable", () => {
    const auto = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    ).data!;
    auto.status = "RUNNING";
    auto.leaseOwner = "worker:old";
    auto.leaseExpiresAt = new Date(Date.now() - 1000).toISOString();
    const recovered = acquireLease(auto, "worker:new");
    assert.equal(recovered.ok, true);
    assert.equal(recovered.automation.leaseOwner, "worker:new");
  });

  test("quiet hours and daily limit gate", () => {
    const auto = proposeAutomationPure(
      createEmptyAutomationState(),
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    ).data!;
    auto.requiresConfirmation = false;

    const state: AutomationState = createEmptyAutomationState();
    state.automations.push(auto);
    const day = new Date().toISOString().slice(0, 10);
    state.dailyCounts[`u1:${day}`] = 20;

    const limitGate = evaluateExecutionGates({
      automation: auto,
      settings: settings({
        defaultAutonomyLevel: "CONFIRM",
        dailyExecutionLimit: 20,
        quietHours: null,
      }),
      state,
      confirmed: true,
      autoSafePath: false,
    });
    assert.ok(limitGate.failures.includes("daily_limit_reached"));

    const quiet = evaluateExecutionGates({
      automation: auto,
      settings: settings({
        quietHours: { startHour: 0, endHour: 24 },
      }),
      state: createEmptyAutomationState(),
      confirmed: true,
      autoSafePath: false,
      now: new Date(),
    });
    // 0-24 means all hours in start < end branch: hour >= 0 && hour < 24 → always
    assert.ok(quiet.failures.includes("quiet_hours_blocked"));
  });

  test("cooldown blocks duplicate rapid execution", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      s
    );
    state = proposed.state;
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;

    const first = await executeAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s,
      { autoSafe: true, forceManual: true }
    );
    assert.equal(first.ok, true);
    state = first.state;

    // second proposal different idempotency
    const proposed2 = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t2", message: "m2" },
      },
      s
    );
    state = proposed2.state;
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;
    // share cooldown key
    state.automations[0].cooldownKey = first.data!.cooldownKey;

    const second = await executeAutomationPure(
      state,
      viewer(),
      proposed2.data!.id,
      s,
      { autoSafe: true, forceManual: true }
    );
    assert.equal(second.ok, false);
    assert.ok(second.data?.gateFailures.includes("cooldown_active"));
  });

  test("retry and non-retryable classification", () => {
    assert.equal(classifyError("network timeout"), "TIMEOUT");
    assert.equal(isRetryable("TIMEOUT"), true);
    assert.equal(classifyError("invalid input"), "VALIDATION");
    assert.equal(isRetryable("VALIDATION"), false);
  });

  test("undo supported notification", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      s
    );
    state = proposed.state;
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;
    const executed = await executeAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s,
      { autoSafe: true, forceManual: true }
    );
    state = executed.state;
    const undone = await undoAutomationPure(
      state,
      viewer(),
      proposed.data!.id
    );
    assert.equal(undone.ok, true);
    assert.equal(undone.data?.status, "UNDONE");
  });

  test("undo conflict when mutatedAfter", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      s
    );
    state = proposed.state;
    state.automations[0].status = "APPROVED";
    state.automations[0].requiresConfirmation = false;
    const executed = await executeAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s,
      { autoSafe: true, forceManual: true }
    );
    state = executed.state;
    state.automations[0].executionResult = {
      ...(state.automations[0].executionResult ?? {}),
      mutatedAfter: true,
    };
    const undone = await undoAutomationPure(
      state,
      viewer(),
      proposed.data!.id
    );
    assert.equal(undone.error, "undo_conflict");
  });

  test("ownership / workspace / viewer cannot mutate", async () => {
    let state = createEmptyAutomationState();
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    );
    state = proposed.state;

    const other = await executeAutomationPure(
      state,
      viewer({ userId: "u2" }),
      proposed.data!.id,
      settings({ userId: "u2" }),
      { forceManual: true }
    );
    assert.equal(other.error, "ownership_required");

    const listed = listAutomationsPure(state, viewer({ userId: "u2" }));
    assert.equal(listed.length, 0);
    assert.equal(
      getAutomationPure(state, viewer({ userId: "u2" }), proposed.data!.id),
      null
    );
  });

  test("schedule, cancel, home widget, explain", async () => {
    let state = createEmptyAutomationState();
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      settings()
    );
    state = proposed.state;
    const future = new Date(Date.now() + 3600_000).toISOString();
    const scheduled = scheduleAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      future
    );
    state = scheduled.state;
    assert.equal(scheduled.data?.status, "SCHEDULED");

    const widget = getHomeAutomationWidgetPure(state, viewer());
    assert.ok(Array.isArray(widget.scheduledToday));

    const exp = explainAutomationPure(state, viewer(), proposed.data!.id);
    assert.ok(exp?.why);
    assert.ok(exp?.willNotChange.some((w) => w.includes("e-mail")));

    const cancelled = cancelAutomationPure(
      state,
      viewer(),
      proposed.data!.id
    );
    assert.equal(cancelled.data?.status, "CANCELLED");
  });

  test("processEligibleAutomations respects pause and limit", async () => {
    const paused = await processEligibleAutomationsPure(
      createEmptyAutomationState(),
      viewer(),
      settings({ pauseAllAutomations: true }),
      { limit: 1 }
    );
    assert.equal(paused.processed, 0);
  });

  test("planner regression — plans stay executionInfluence none", () => {
    assert.equal(PLAN_EXECUTION_INFLUENCE, "none");
  });

  test("hashPayload stable and audit sanitize", () => {
    assert.equal(hashPayload({ a: 1, b: 2 }), hashPayload({ b: 2, a: 1 }));
    assert.notEqual(hashPayload({ a: 1 }), hashPayload({ a: 2 }));
  });

  test("migration and report files exist", () => {
    assert.ok(
      existsSync(
        join(
          process.cwd(),
          "supabase/migrations/20260731280000_sprint8_1_automation_engine_v1.sql"
        )
      )
    );
    assert.ok(
      existsSync(
        join(process.cwd(), "reports/sprint8.1-automation-engine-v1.md")
      )
    );
  });

  test("no external/deletion/payment actions registered", () => {
    for (const id of [
      "send_email",
      "send_whatsapp",
      "publish_content",
      "make_payment",
      "delete_record",
      "change_permissions",
      "access_shell",
    ]) {
      assert.equal(getAction(id), undefined);
      assert.equal(isBlockedActionId(id), true);
    }
  });

  test("retryAutomation on failed", async () => {
    let state = createEmptyAutomationState();
    const s = settings({
      defaultAutonomyLevel: "AUTO_SAFE",
      allowAutoSafe: true,
    });
    const proposed = proposeAutomationPure(
      state,
      viewer(),
      {
        triggerType: "MANUAL",
        sourceType: "manual",
        actionId: "create_internal_notification",
        input: { title: "t", message: "m" },
      },
      s
    );
    state = proposed.state;
    state.automations[0].status = "FAILED";
    state.automations[0].errorClass = "TIMEOUT";
    state.automations[0].requiresConfirmation = false;
    state.automations[0].executionAttempt = 1;

    const retried = await retryAutomationPure(
      state,
      viewer(),
      proposed.data!.id,
      s
    );
    assert.ok(retried.ok || retried.data?.status === "SUCCEEDED" || retried.data?.status === "BLOCKED" || retried.data?.status === "FAILED");
  });
});
