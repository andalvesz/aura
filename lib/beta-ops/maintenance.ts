/**
 * Maintenance mode — never a substitute for authorization.
 * Admins with allowlist may bypass when authorized.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { MaintenanceRule, MaintenanceScope } from "@/lib/beta-ops/types";
import { createOpsNotification } from "@/lib/beta-ops/notifications";

export function createMaintenanceRulePure(
  state: BetaOpsState,
  input: {
    scope: MaintenanceScope;
    scopeKey?: string | null;
    message: string;
    active?: boolean;
    startsAt?: string;
    endsAt?: string | null;
    createdBy: string;
    notifyUserIds?: string[];
  }
): { state: BetaOpsState; rule: MaintenanceRule } {
  const rule: MaintenanceRule = {
    id: newId("maint"),
    scope: input.scope,
    scopeKey: input.scopeKey ?? null,
    message: input.message.trim().slice(0, 500),
    active: input.active ?? true,
    startsAt: input.startsAt ?? nowIso(),
    endsAt: input.endsAt ?? null,
    createdBy: input.createdBy,
    createdAt: nowIso(),
    softDeleted: false,
  };
  let next: BetaOpsState = {
    ...state,
    maintenanceRules: [...state.maintenanceRules, rule],
  };
  next = pushOpsAudit(next, {
    event: "maintenance_rule_created",
    actorId: input.createdBy,
    subjectType: "maintenance",
    subjectId: rule.id,
    summary: `Maintenance ${rule.scope}`,
    metadata: { scope: rule.scope, scopeKey: rule.scopeKey },
    correlationId: null,
  });
  for (const uid of input.notifyUserIds ?? []) {
    next = createOpsNotification(next, {
      userId: uid,
      kind: "maintenance",
      title: "Manutenção programada",
      body: rule.message,
      href: null,
    });
  }
  return { state: next, rule };
}

export function deactivateMaintenancePure(
  state: BetaOpsState,
  ruleId: string,
  actorId: string
): { state: BetaOpsState; ok: boolean } {
  const idx = state.maintenanceRules.findIndex((r) => r.id === ruleId && !r.softDeleted);
  if (idx < 0) return { state, ok: false };
  const rules = [...state.maintenanceRules];
  rules[idx] = { ...rules[idx]!, active: false };
  let next: BetaOpsState = { ...state, maintenanceRules: rules };
  next = pushOpsAudit(next, {
    event: "maintenance_deactivated",
    actorId,
    subjectType: "maintenance",
    subjectId: ruleId,
    summary: "Maintenance deactivated",
    metadata: {},
    correlationId: null,
  });
  return { state: next, ok: true };
}

export function resolveMaintenance(
  state: BetaOpsState,
  input: {
    route?: string | null;
    workspaceId?: string | null;
    capabilityId?: string | null;
    isAdminBypass?: boolean;
    now?: number;
  }
): { active: boolean; message: string | null; ruleId: string | null } {
  if (input.isAdminBypass) {
    return { active: false, message: null, ruleId: null };
  }
  const nowIsoStr = new Date(input.now ?? Date.now()).toISOString();
  const active = state.maintenanceRules.filter((r) => {
    if (r.softDeleted || !r.active) return false;
    if (r.startsAt > nowIsoStr) return false;
    if (r.endsAt && r.endsAt < nowIsoStr) return false;
    if (r.scope === "global") return true;
    if (r.scope === "route" && r.scopeKey && input.route?.startsWith(r.scopeKey)) return true;
    if (r.scope === "workspace" && r.scopeKey === input.workspaceId) return true;
    if (r.scope === "capability" && r.scopeKey === input.capabilityId) return true;
    return false;
  });
  const rule = active[0];
  if (!rule) return { active: false, message: null, ruleId: null };
  return { active: true, message: rule.message, ruleId: rule.id };
}

export function createMaintenanceRule(input: Parameters<typeof createMaintenanceRulePure>[1]) {
  const res = createMaintenanceRulePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
