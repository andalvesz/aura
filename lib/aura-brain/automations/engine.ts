/**
 * Automation Engine — idempotent, limited, audited.
 */

import { executeAuraBrainAction } from "@/lib/aura-brain/actions/executor";
import type { ActionAdapters } from "@/lib/aura-brain/actions/types";
import {
  isCriticalNotificationProposal,
  todayKey,
} from "@/lib/aura-brain/automations/conditions";
import {
  ensureBuiltinAutomations,
  listAutomations,
} from "@/lib/aura-brain/automations/registry";
import type {
  AutomationRunState,
  AutomationTrigger,
} from "@/lib/aura-brain/automations/types";
import type {
  AutomationResult,
  AuraBrainSettings,
  ProposedAction,
} from "@/lib/aura-brain/types";
import { autonomyAllowsExecution } from "@/lib/aura-brain/autonomy";

const globalState: AutomationRunState = {
  lastRunAt: {},
  dailyCounts: {},
  notifiedKeys: new Set(),
};

export function getAutomationState(): AutomationRunState {
  return globalState;
}

export function resetAutomationState(): void {
  globalState.lastRunAt = {};
  globalState.dailyCounts = {};
  globalState.notifiedKeys.clear();
}

export function markNotified(dedupeKey: string): void {
  globalState.notifiedKeys.add(dedupeKey);
}

function dailyCount(automationId: string): number {
  const day = todayKey();
  const row = globalState.dailyCounts[automationId];
  if (!row || row.day !== day) return 0;
  return row.count;
}

function bumpDaily(automationId: string): void {
  const day = todayKey();
  const row = globalState.dailyCounts[automationId];
  if (!row || row.day !== day) {
    globalState.dailyCounts[automationId] = { day, count: 1 };
  } else {
    row.count += 1;
  }
}

export type RunAutomationsInput = {
  userId: string;
  workspaceId?: string | null;
  context: "personal" | "workspace";
  trigger: AutomationTrigger;
  settings: AuraBrainSettings;
  proposedActions: ProposedAction[];
  adapters?: ActionAdapters;
  userRole?: string | null;
};

export async function runAuraBrainAutomations(
  input: RunAutomationsInput
): Promise<AutomationResult[]> {
  ensureBuiltinAutomations();
  if (!input.settings.automationsEnabled) {
    return [
      {
        automationId: "*",
        status: "skipped",
        reason: "Automações desabilitadas",
        actionId: null,
        auditId: null,
      },
    ];
  }

  const results: AutomationResult[] = [];
  const now = Date.now();

  for (const auto of listAutomations()) {
    if (!auto.enabled) {
      results.push({
        automationId: auto.id,
        status: "skipped",
        reason: "disabled",
        actionId: null,
        auditId: null,
      });
      continue;
    }
    if (auto.trigger !== input.trigger) continue;
    if (auto.context !== "any" && auto.context !== input.context) continue;

    if (
      !autonomyAllowsExecution(
        input.settings.defaultAutonomyLevel,
        auto.autonomyRequirement
      )
    ) {
      results.push({
        automationId: auto.id,
        status: "skipped",
        reason: "autonomia insuficiente",
        actionId: auto.actionId,
        auditId: null,
      });
      continue;
    }

    const last = globalState.lastRunAt[`${input.userId}:${auto.id}`] ?? 0;
    if (now - last < auto.cooldownMs) {
      results.push({
        automationId: auto.id,
        status: "skipped",
        reason: "cooldown",
        actionId: auto.actionId,
        auditId: null,
      });
      continue;
    }

    if (dailyCount(auto.id) >= auto.maxExecutionsPerDay) {
      results.push({
        automationId: auto.id,
        status: "skipped",
        reason: "limite diário",
        actionId: auto.actionId,
        auditId: null,
      });
      continue;
    }

    if (auto.id === "notify_critical_priority") {
      const candidates = input.proposedActions.filter(isCriticalNotificationProposal);
      let ran = false;
      for (const prop of candidates) {
        if (globalState.notifiedKeys.has(prop.dedupeKey)) {
          results.push({
            automationId: auto.id,
            status: "skipped",
            reason: "já notificado",
            actionId: auto.actionId,
            auditId: null,
          });
          continue;
        }

        const exec = await executeAuraBrainAction({
          actionId: auto.actionId,
          userId: input.userId,
          workspaceId: input.workspaceId,
          context: input.context,
          input: prop.input,
          settings: {
            ...input.settings,
            // Auto-safe path for this LOW action
            defaultAutonomyLevel:
              input.settings.defaultAutonomyLevel === "SUGGEST"
                ? "SUGGEST"
                : input.settings.defaultAutonomyLevel,
          },
          confirmed: false,
          userRole: input.userRole,
          dailyCount: dailyCount(auto.id),
          dedupeHit: false,
          cooldownActive: false,
          planId: prop.planId,
          automationId: auto.id,
          source: "automation:notify_critical_priority",
          adapters: input.adapters,
        });

        // Only auto-execute when user autonomy is AUTO_SAFE
        if (input.settings.defaultAutonomyLevel !== "AUTO_SAFE") {
          results.push({
            automationId: auto.id,
            status: "skipped",
            reason: "requer AUTO_SAFE para executar",
            actionId: auto.actionId,
            auditId: exec.audit.id,
          });
          continue;
        }

        if (exec.rejected) {
          results.push({
            automationId: auto.id,
            status: "skipped",
            reason: exec.rejectReason ?? "rejeitado",
            actionId: auto.actionId,
            auditId: exec.audit.id,
          });
          continue;
        }

        if (!exec.result.ok) {
          results.push({
            automationId: auto.id,
            status: "failed",
            reason: exec.result.error ?? "falha",
            actionId: auto.actionId,
            auditId: exec.audit.id,
          });
          continue;
        }

        globalState.notifiedKeys.add(prop.dedupeKey);
        globalState.lastRunAt[`${input.userId}:${auto.id}`] = now;
        bumpDaily(auto.id);
        ran = true;
        results.push({
          automationId: auto.id,
          status: "executed",
          reason:
            exec.result.output.skipped === true
              ? "idempotent_skip"
              : "notification_created",
          actionId: auto.actionId,
          auditId: exec.audit.id,
        });
      }
      if (!ran && candidates.length === 0) {
        results.push({
          automationId: auto.id,
          status: "skipped",
          reason: "sem prioridades críticas",
          actionId: auto.actionId,
          auditId: null,
        });
      }
    }
  }

  return results;
}
