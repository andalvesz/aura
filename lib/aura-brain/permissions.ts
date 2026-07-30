/**
 * Permission helpers for Aura Brain actions.
 * Never trusts client-supplied userId / workspaceId.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainContextMode,
  AuraBrainSettings,
} from "@/lib/aura-brain/types";
import {
  autonomyAllowsExecution,
  isInQuietHours,
  riskCompatibleWithAutonomy,
} from "@/lib/aura-brain/autonomy";

export type ActionPermissionCheck = {
  registered: boolean;
  actionId: string;
  context: AuraBrainContextMode;
  allowedContexts: AuraBrainContextMode[];
  requiredRole: "any" | "member" | "admin" | "owner" | null;
  userRole: string | null;
  settings: AuraBrainSettings;
  autonomyRequired: AutonomyLevel;
  riskLevel: ActionRiskLevel;
  confirmed?: boolean;
  isFinancial?: boolean;
  isExternalComm?: boolean;
  isDeletion?: boolean;
  dailyCount: number;
  dedupeHit: boolean;
  cooldownActive: boolean;
  expired?: boolean;
};

export function evaluateActionPermission(
  check: ActionPermissionCheck
): { allowed: boolean; reason: string | null } {
  if (!check.registered) {
    return { allowed: false, reason: "Ação não registrada" };
  }
  if (check.expired) {
    return { allowed: false, reason: "Ação expirada" };
  }
  if (!check.allowedContexts.includes(check.context)) {
    return { allowed: false, reason: "Contexto incorreto para a ação" };
  }
  if (
    check.settings.blockedActionTypes.includes(check.actionId) ||
    (check.settings.allowedActionTypes.length > 0 &&
      !check.settings.allowedActionTypes.includes(check.actionId))
  ) {
    return { allowed: false, reason: "Ação bloqueada nas configurações" };
  }
  if (check.requiredRole && check.requiredRole !== "any") {
    const role = (check.userRole ?? "member").toLowerCase();
    if (check.requiredRole === "owner" && role !== "owner") {
      return { allowed: false, reason: "Requer papel owner" };
    }
    if (
      check.requiredRole === "admin" &&
      role !== "admin" &&
      role !== "owner"
    ) {
      return { allowed: false, reason: "Requer papel admin/owner" };
    }
  }
  if (!autonomyAllowsExecution(check.settings.defaultAutonomyLevel, check.autonomyRequired)) {
    return {
      allowed: false,
      reason: `Autonomia ${check.settings.defaultAutonomyLevel} < ${check.autonomyRequired}`,
    };
  }
  const risk = riskCompatibleWithAutonomy(
    check.riskLevel,
    check.settings.defaultAutonomyLevel,
    {
      confirmed: check.confirmed,
      isFinancial: check.isFinancial,
      isExternalComm: check.isExternalComm,
      isDeletion: check.isDeletion,
      settings: check.settings,
    }
  );
  if (!risk.ok) {
    return { allowed: false, reason: risk.reason };
  }
  if (isInQuietHours(check.settings.quietHours)) {
    return { allowed: false, reason: "Quiet hours ativas" };
  }
  if (check.dailyCount >= check.settings.dailyExecutionLimit) {
    return { allowed: false, reason: "Limite diário atingido" };
  }
  if (check.dedupeHit) {
    return { allowed: false, reason: "Ação duplicada" };
  }
  if (check.cooldownActive) {
    return { allowed: false, reason: "Cooldown ativo" };
  }
  return { allowed: true, reason: null };
}
