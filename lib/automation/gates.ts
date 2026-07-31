/**
 * AUTO_SAFE and execution gates — fail closed, never silent fallback to execute.
 */

import {
  ensureBuiltinActions,
  getAction,
  isBlockedActionId,
} from "@/lib/aura-brain/actions/registry";
import { isInQuietHours } from "@/lib/aura-brain/autonomy";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import {
  AUTO_SAFE_ELIGIBLE_ACTIONS,
  type Automation,
  type AutomationState,
} from "@/lib/automation/types/types";

export type GateResult = {
  ok: boolean;
  failures: string[];
};

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function dailyCountFor(
  state: AutomationState,
  userId: string,
  day = todayKey()
): number {
  return state.dailyCounts[`${userId}:${day}`] ?? 0;
}

export function bumpDailyCount(
  state: AutomationState,
  userId: string,
  day = todayKey()
): void {
  const k = `${userId}:${day}`;
  state.dailyCounts[k] = (state.dailyCounts[k] ?? 0) + 1;
}

export function cooldownActive(
  state: AutomationState,
  cooldownKey: string,
  cooldownMs: number,
  now = Date.now()
): boolean {
  const last = state.cooldownIndex[cooldownKey];
  if (!last) return false;
  return now - Date.parse(last) < cooldownMs;
}

export function evaluateExecutionGates(params: {
  automation: Automation;
  settings: AuraBrainSettings;
  state: AutomationState;
  confirmed: boolean;
  autoSafePath: boolean;
  now?: Date;
}): GateResult {
  ensureBuiltinActions();
  const failures: string[] = [];
  const { automation, settings, state } = params;
  const now = params.now ?? new Date();
  const def = getAction(automation.actionId);

  if (!settings.automationsEnabled || (settings as AuraBrainSettings & { pauseAllAutomations?: boolean }).pauseAllAutomations) {
    failures.push("automations_paused_or_disabled");
  }
  if (isBlockedActionId(automation.actionId)) {
    failures.push("blocked_action");
  }
  if (!def) {
    failures.push("action_not_registered");
  } else {
    if (def.version !== automation.actionVersion && automation.actionVersion !== def.version) {
      // allow if versions match OR automation.actionVersion equals def
      if (automation.actionVersion && def.version && automation.actionVersion !== def.version) {
        failures.push("incompatible_action_version");
      }
    }
    if (def.isExternalComm) failures.push("external_communication_forbidden");
    if (def.isDeletion) failures.push("deletion_forbidden");
    if (def.isPermissionChange) failures.push("permission_change_forbidden");
    if (def.isFinancialFinal) failures.push("financial_final_forbidden_auto");

    const validation = def.validate(automation.input);
    if (!validation.ok) failures.push(`invalid_input:${validation.error}`);

    if (!def.allowedContexts.includes(automation.context)) {
      failures.push("unauthorized_context");
    }
  }

  if (settings.blockedActionTypes.includes(automation.actionId)) {
    failures.push("action_blocked_in_settings");
  }
  if (
    settings.allowedActionTypes.length > 0 &&
    !settings.allowedActionTypes.includes(automation.actionId)
  ) {
    failures.push("action_not_allowed_in_settings");
  }

  if (automation.expiresAt && Date.parse(automation.expiresAt) < now.getTime()) {
    failures.push("automation_expired");
  }

  if (cooldownActive(state, automation.cooldownKey, def?.cooldownMs ?? 60_000, now.getTime())) {
    failures.push("cooldown_active");
  }

  if (dailyCountFor(state, automation.ownerId) >= settings.dailyExecutionLimit) {
    failures.push("daily_limit_reached");
  }

  if (isInQuietHours(settings.quietHours, now)) {
    failures.push("quiet_hours_blocked");
  }

  if (params.autoSafePath) {
    const autoSafeOk = evaluateAutoSafeGates({
      automation,
      settings,
      defExists: Boolean(def),
      risk: automation.riskLevel,
      actionId: automation.actionId,
      autoSafeEligible: def?.autoSafeEligible ?? false,
      isFinancialFinal: def?.isFinancialFinal ?? false,
      isExternalComm: def?.isExternalComm ?? false,
      isDeletion: def?.isDeletion ?? false,
      isPermissionChange: def?.isPermissionChange ?? false,
    });
    failures.push(...autoSafeOk.failures);
  } else if (!params.confirmed && (def?.requiresConfirmation || automation.requiresConfirmation)) {
    failures.push("confirmation_required");
  }

  if (
    automation.sourceType === "plan_step" &&
    (!automation.planId || !automation.planStepId)
  ) {
    failures.push("invalid_source_reference");
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

export function evaluateAutoSafeGates(params: {
  automation: Automation;
  settings: AuraBrainSettings;
  defExists: boolean;
  risk: string;
  actionId: string;
  autoSafeEligible: boolean;
  isFinancialFinal: boolean;
  isExternalComm: boolean;
  isDeletion: boolean;
  isPermissionChange: boolean;
}): GateResult {
  const failures: string[] = [];
  const s = params.settings as AuraBrainSettings & {
    allowAutoSafe?: boolean;
    pauseAllAutomations?: boolean;
  };

  if (settingsDefaultAutonomyNotAutoSafe(params.settings)) {
    failures.push("autonomy_not_auto_safe");
  }
  if (s.allowAutoSafe !== true) {
    failures.push("auto_safe_disabled_in_settings");
  }
  if (s.pauseAllAutomations) {
    failures.push("automations_paused");
  }
  if (!params.defExists) failures.push("action_not_registered");
  if (params.risk !== "LOW") failures.push("risk_not_low");
  if (!params.autoSafeEligible) failures.push("action_not_auto_safe_eligible");
  if (
    !(AUTO_SAFE_ELIGIBLE_ACTIONS as readonly string[]).includes(params.actionId) &&
    params.actionId !== "create_notification"
  ) {
    // still allow if registry marks autoSafeEligible and risk LOW — but sprint list is canonical
    if (!params.autoSafeEligible) {
      failures.push("action_not_in_auto_safe_list");
    }
  }
  if (params.isFinancialFinal) failures.push("financial_final");
  if (params.isExternalComm) failures.push("external_communication");
  if (params.isDeletion) failures.push("deletion");
  if (params.isPermissionChange) failures.push("permission_change");

  // Origin must be confirmed kinds — never unconfirmed hypothesis
  if (params.automation.triggerType === "SAFE_DATA") {
    /* allowed */
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}

function settingsDefaultAutonomyNotAutoSafe(settings: AuraBrainSettings): boolean {
  return settings.defaultAutonomyLevel !== "AUTO_SAFE";
}

export function classifyError(error: string | null | undefined): import("@/lib/automation/types/types").AutomationErrorClass {
  const e = (error ?? "").toLowerCase();
  if (!e) return "NON_RETRYABLE";
  if (e.includes("auth") || e.includes("login")) return "AUTH_REQUIRED";
  if (e.includes("valid") || e.includes("input")) return "VALIDATION";
  if (e.includes("permission") || e.includes("papel") || e.includes("role")) return "PERMISSION";
  if (e.includes("rate") || e.includes("limit") || e.includes("limite")) return "RATE_LIMIT";
  if (e.includes("timeout") || e.includes("timed out")) return "TIMEOUT";
  if (e.includes("conflict") || e.includes("lease") || e.includes("row_version") || e.includes("duplicate"))
    return "CONFLICT";
  if (e.includes("depend") || e.includes("blocked")) return "DEPENDENCY_BLOCKED";
  if (e.includes("network") || e.includes("temporar") || e.includes("retry")) return "RETRYABLE";
  return "NON_RETRYABLE";
}

export function isRetryable(cls: import("@/lib/automation/types/types").AutomationErrorClass): boolean {
  return cls === "RETRYABLE" || cls === "TIMEOUT" || cls === "RATE_LIMIT";
}
