/**
 * Autonomy levels and safe defaults.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainSettings,
} from "@/lib/aura-brain/types";
import { DEFAULT_AURA_BRAIN_SETTINGS } from "@/lib/aura-brain/types";

const AUTONOMY_RANK: Record<AutonomyLevel, number> = {
  SUGGEST: 0,
  PREPARE: 1,
  CONFIRM: 2,
  AUTO_SAFE: 3,
};

/** Risk ceilings per autonomy — what may actually execute without extra confirmation UI */
const RISK_ALLOWED_FOR_AUTO: Record<AutonomyLevel, ActionRiskLevel[]> = {
  SUGGEST: [],
  PREPARE: [],
  CONFIRM: [], // needs explicit user confirm
  AUTO_SAFE: ["LOW"],
};

export function autonomyRank(level: AutonomyLevel): number {
  return AUTONOMY_RANK[level];
}

export function autonomyAllowsExecution(
  userLevel: AutonomyLevel,
  required: AutonomyLevel
): boolean {
  return AUTONOMY_RANK[userLevel] >= AUTONOMY_RANK[required];
}

export function riskCompatibleWithAutonomy(
  risk: ActionRiskLevel,
  userLevel: AutonomyLevel,
  opts?: {
    confirmed?: boolean;
    isFinancial?: boolean;
    isExternalComm?: boolean;
    isDeletion?: boolean;
    isPermissionChange?: boolean;
    settings?: Pick<
      AuraBrainSettings,
      | "requireConfirmationForFinancialActions"
      | "requireConfirmationForExternalCommunication"
      | "requireConfirmationForDeletion"
    >;
  }
): { ok: boolean; reason: string | null } {
  if (opts?.isPermissionChange || opts?.isDeletion) {
    if (!opts.confirmed) {
      return { ok: false, reason: "Exclusão/permissão exige confirmação explícita" };
    }
  }

  const settings = opts?.settings ?? DEFAULT_AURA_BRAIN_SETTINGS;
  if (
    opts?.isFinancial &&
    settings.requireConfirmationForFinancialActions &&
    !opts.confirmed
  ) {
    return { ok: false, reason: "Ação financeira exige confirmação" };
  }
  if (
    opts?.isExternalComm &&
    settings.requireConfirmationForExternalCommunication &&
    !opts.confirmed
  ) {
    return { ok: false, reason: "Comunicação externa exige confirmação" };
  }
  if (
    opts?.isDeletion &&
    settings.requireConfirmationForDeletion &&
    !opts.confirmed
  ) {
    return { ok: false, reason: "Exclusão exige confirmação" };
  }

  if (risk === "CRITICAL" || risk === "HIGH") {
    if (!opts?.confirmed) {
      return { ok: false, reason: `Risco ${risk} não pode ser automático` };
    }
    return { ok: true, reason: null };
  }

  if (userLevel === "AUTO_SAFE") {
    if (!RISK_ALLOWED_FOR_AUTO.AUTO_SAFE.includes(risk)) {
      return { ok: false, reason: "AUTO_SAFE só permite risco LOW" };
    }
    return { ok: true, reason: null };
  }

  if (userLevel === "CONFIRM" && opts?.confirmed) {
    return { ok: true, reason: null };
  }

  if (userLevel === "PREPARE" || userLevel === "SUGGEST") {
    return {
      ok: false,
      reason: `Nível ${userLevel} não executa ações finais`,
    };
  }

  return { ok: false, reason: "Autonomia insuficiente" };
}

export function isInQuietHours(
  quiet: AuraBrainSettings["quietHours"],
  now = new Date()
): boolean {
  if (!quiet) return false;
  const hour = now.getHours();
  if (quiet.startHour === quiet.endHour) return false;
  if (quiet.startHour < quiet.endHour) {
    return hour >= quiet.startHour && hour < quiet.endHour;
  }
  // wraps midnight
  return hour >= quiet.startHour || hour < quiet.endHour;
}

export function mergeSettings(
  userId: string,
  partial?: Partial<AuraBrainSettings> | null
): AuraBrainSettings {
  return {
    ...DEFAULT_AURA_BRAIN_SETTINGS,
    ...partial,
    userId,
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}
