/**
 * Action Executor — validates autonomy, permissions, then runs registered actions.
 */

import { createAuditEntry, pushAuditEntry } from "@/lib/aura-brain/audit";
import {
  ensureBuiltinActions,
  getAction,
} from "@/lib/aura-brain/actions/registry";
import type {
  ActionAdapters,
  ActionExecuteResult,
} from "@/lib/aura-brain/actions/types";
import { evaluateActionPermission } from "@/lib/aura-brain/permissions";
import type {
  AutonomyLevel,
  AuraBrainAuditEntry,
  AuraBrainContextMode,
  AuraBrainSettings,
} from "@/lib/aura-brain/types";

export type ExecuteActionRequest = {
  actionId: string;
  userId: string;
  workspaceId?: string | null;
  context: AuraBrainContextMode;
  input: Record<string, unknown>;
  settings: AuraBrainSettings;
  confirmed?: boolean;
  userRole?: string | null;
  dailyCount?: number;
  dedupeHit?: boolean;
  cooldownActive?: boolean;
  expired?: boolean;
  planId?: string | null;
  automationId?: string | null;
  source?: string;
  adapters?: ActionAdapters;
};

export type ExecuteActionResponse = {
  result: ActionExecuteResult;
  audit: AuraBrainAuditEntry;
  rejected: boolean;
  rejectReason: string | null;
};

export async function executeAuraBrainAction(
  req: ExecuteActionRequest
): Promise<ExecuteActionResponse> {
  ensureBuiltinActions();
  const def = getAction(req.actionId);
  const autonomy: AutonomyLevel = req.settings.defaultAutonomyLevel;

  if (!def) {
    const audit = createAuditEntry({
      userId: req.userId,
      workspaceId: req.workspaceId,
      context: req.context,
      source: req.source ?? "executor",
      actionId: req.actionId,
      planId: req.planId,
      automationId: req.automationId,
      autonomyLevel: autonomy,
      input: req.input,
      status: "rejected",
      error: "Ação não registrada",
    });
    pushAuditEntry(audit);
    return {
      result: { ok: false, output: {}, error: "Ação não registrada" },
      audit,
      rejected: true,
      rejectReason: "Ação não registrada",
    };
  }

  const validation = def.validate(req.input);
  if (!validation.ok) {
    const audit = createAuditEntry({
      userId: req.userId,
      workspaceId: req.workspaceId,
      context: req.context,
      source: req.source ?? "executor",
      actionId: req.actionId,
      planId: req.planId,
      automationId: req.automationId,
      autonomyLevel: autonomy,
      riskLevel: def.riskLevel,
      input: req.input,
      status: "rejected",
      error: validation.error,
    });
    pushAuditEntry(audit);
    return {
      result: { ok: false, output: {}, error: validation.error },
      audit,
      rejected: true,
      rejectReason: validation.error,
    };
  }

  const perm = evaluateActionPermission({
    registered: true,
    actionId: def.id,
    context: req.context,
    allowedContexts: def.allowedContexts,
    requiredRole: def.requiredRole,
    userRole: req.userRole ?? null,
    settings: req.settings,
    autonomyRequired: def.autonomySupport,
    riskLevel: def.riskLevel,
    confirmed: req.confirmed,
    isFinancial: def.isFinancial,
    isExternalComm: def.isExternalComm,
    isDeletion: def.isDeletion,
    dailyCount: req.dailyCount ?? 0,
    dedupeHit: req.dedupeHit ?? false,
    cooldownActive: req.cooldownActive ?? false,
    expired: req.expired,
  });

  if (!perm.allowed) {
    const audit = createAuditEntry({
      userId: req.userId,
      workspaceId: req.workspaceId,
      context: req.context,
      source: req.source ?? "executor",
      actionId: req.actionId,
      planId: req.planId,
      automationId: req.automationId,
      autonomyLevel: autonomy,
      riskLevel: def.riskLevel,
      input: req.input,
      status: "rejected",
      error: perm.reason,
    });
    pushAuditEntry(audit);
    return {
      result: { ok: false, output: {}, error: perm.reason },
      audit,
      rejected: true,
      rejectReason: perm.reason,
    };
  }

  try {
    const result = await def.execute({
      userId: req.userId,
      workspaceId: req.workspaceId ?? null,
      context: req.context,
      input: req.input,
      confirmed: Boolean(req.confirmed),
      adapters: req.adapters,
    });
    const audit = createAuditEntry({
      userId: req.userId,
      workspaceId: req.workspaceId,
      context: req.context,
      source: req.source ?? "executor",
      actionId: req.actionId,
      planId: req.planId,
      automationId: req.automationId,
      autonomyLevel: autonomy,
      riskLevel: def.riskLevel,
      input: req.input,
      status: result.ok ? "executed" : "failed",
      error: result.error,
      undoAvailable: Boolean(result.undoToken) && Boolean(def.undo),
    });
    pushAuditEntry(audit);
    return { result, audit, rejected: false, rejectReason: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na execução";
    const audit = createAuditEntry({
      userId: req.userId,
      workspaceId: req.workspaceId,
      context: req.context,
      source: req.source ?? "executor",
      actionId: req.actionId,
      planId: req.planId,
      automationId: req.automationId,
      autonomyLevel: autonomy,
      riskLevel: def.riskLevel,
      input: req.input,
      status: "failed",
      error: message,
    });
    pushAuditEntry(audit);
    return {
      result: { ok: false, output: {}, error: message },
      audit,
      rejected: false,
      rejectReason: null,
    };
  }
}
