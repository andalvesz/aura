/**
 * Automation Engine V1 — propose → prepare → confirm → execute → audit → undo.
 * Reuses Aura Brain Action Registry + autonomy + audit. No autonomous agents.
 */

import {
  ensureBuiltinActions,
  getAction,
  isBlockedActionId,
  sanitizeActionInput,
} from "@/lib/aura-brain/actions/registry";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import { DEFAULT_AURA_BRAIN_SETTINGS } from "@/lib/aura-brain/types";
import {
  bumpDailyCount,
  classifyError,
  cooldownActive,
  evaluateExecutionGates,
  isRetryable,
} from "@/lib/automation/gates";
import {
  acquireLease,
  conditionalUpdate,
  hashPayload,
  newId,
  releaseLease,
} from "@/lib/automation/lease";
import {
  CONFIRMATION_TTL_MS,
  DEFAULT_MAX_ATTEMPTS,
  UNDO_WINDOW_MS,
  type Automation,
  type AutomationAuditAction,
  type AutomationAuditEntry,
  type AutomationConfirmation,
  type AutomationErrorClass,
  type AutomationExplanation,
  type AutomationHomeWidget,
  type AutomationListFilters,
  type AutomationNotification,
  type AutomationState,
  type AutomationStatus,
  type AutomationViewer,
  type ProposeAutomationInput,
} from "@/lib/automation/types/types";

export type EngineResult<T> = {
  ok: boolean;
  error: string | null;
  data: T | null;
  state: AutomationState;
};

function nowIso(n = Date.now()): string {
  return new Date(n).toISOString();
}

function pushAudit(
  state: AutomationState,
  entry: Omit<AutomationAuditEntry, "id" | "createdAt"> & { createdAt?: string }
): void {
  state.audits.unshift({
    id: newId("aud"),
    createdAt: entry.createdAt ?? nowIso(),
    ...entry,
  });
}

function pushNotification(
  state: AutomationState,
  n: Omit<AutomationNotification, "id" | "createdAt" | "read"> & {
    read?: boolean;
  }
): void {
  state.notifications.unshift({
    id: newId("an"),
    createdAt: nowIso(),
    read: n.read ?? false,
    ...n,
  });
}

function findAuto(
  state: AutomationState,
  id: string
): Automation | undefined {
  return state.automations.find((a) => a.id === id && !a.softDeleted);
}

function replaceAuto(state: AutomationState, auto: Automation): void {
  const i = state.automations.findIndex((a) => a.id === auto.id);
  if (i >= 0) state.automations[i] = auto;
  else state.automations.unshift(auto);
}

function canMutate(
  viewer: AutomationViewer,
  auto: Automation
): { ok: boolean; reason: string | null } {
  if (viewer.userId !== auto.ownerId && viewer.userId !== auto.createdBy) {
    if (auto.workspaceId) {
      if (!viewer.isWorkspaceMember) {
        return { ok: false, reason: "workspace_membership_required" };
      }
      const role = (viewer.role ?? "viewer").toLowerCase();
      if (role === "viewer") return { ok: false, reason: "viewer_cannot_mutate" };
    } else {
      return { ok: false, reason: "ownership_required" };
    }
  }
  if (
    auto.workspaceId &&
    viewer.workspaceId &&
    auto.workspaceId !== viewer.workspaceId
  ) {
    return { ok: false, reason: "workspace_mismatch" };
  }
  return { ok: true, reason: null };
}

function canView(
  viewer: AutomationViewer,
  auto: Automation
): boolean {
  if (viewer.userId === auto.ownerId || viewer.userId === auto.createdBy)
    return true;
  if (auto.workspaceId && viewer.isWorkspaceMember) return true;
  return false;
}

function mapStepTypeToAction(stepType?: string | null): string {
  switch ((stepType ?? "").toUpperCase()) {
    case "REVIEW":
      return "create_plan_review_reminder";
    case "PREPARE":
      return "create_personal_task_draft";
    case "EXECUTE_MANUAL":
      return "create_personal_task_draft";
    case "MILESTONE":
      return "create_internal_notification";
    case "DECIDE":
      return "create_internal_notification";
    default:
      return "create_internal_notification";
  }
}

function buildExplainFields(
  input: ProposeAutomationInput,
  actionId: string
): Pick<
  Automation,
  | "explainSummary"
  | "evidence"
  | "limitations"
  | "willChange"
  | "willNotChange"
> {
  return {
    explainSummary: `Proposta a partir de ${input.sourceType}${
      input.planStepId ? ` (etapa ${input.planStepId})` : ""
    } para ação ${actionId}.`,
    evidence: [
      input.planId ? `plano:${input.planId}` : null,
      input.planStepId ? `etapa:${input.planStepId}` : null,
      input.sourceId ? `fonte:${input.sourceId}` : null,
    ].filter(Boolean) as string[],
    limitations: [
      "Sem comunicação externa",
      "Sem pagamentos",
      "Sem exclusão automática",
      "Sem mudança de permissões",
      "Sem agentes autônomos",
    ],
    willChange: [`Artefato interno via ${actionId}`],
    willNotChange: [
      "Identity / Memory / World / Cognitive / Discovery kernels",
      "Permissões de workspace",
      "Dados financeiros finais (salvo ação CONFIRM explícita)",
      "Conteúdo externo / e-mail / WhatsApp",
    ],
  };
}

export function proposeAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  input: ProposeAutomationInput,
  settings: AuraBrainSettings = {
    ...DEFAULT_AURA_BRAIN_SETTINGS,
    userId: viewer.userId,
    updatedAt: nowIso(),
  }
): EngineResult<Automation> {
  ensureBuiltinActions();
  const next = {
    ...state,
    automations: [...state.automations],
    audits: [...state.audits],
    notifications: [...state.notifications],
    attempts: [...state.attempts],
    confirmations: [...state.confirmations],
    idempotencyIndex: { ...state.idempotencyIndex },
    cooldownIndex: { ...state.cooldownIndex },
    dailyCounts: { ...state.dailyCounts },
  };

  // Never execute from unconfirmed hypothesis / discovery
  if (input.hypothesisConfirmed === false) {
    return {
      ok: false,
      error: "unconfirmed_hypothesis_cannot_automate",
      data: null,
      state,
    };
  }

  if (input.sourceType === "plan_step") {
    const ps = (input.planStatus ?? "").toUpperCase();
    if (ps && !["APPROVED", "IN_PROGRESS"].includes(ps)) {
      return {
        ok: false,
        error: "plan_not_approved",
        data: null,
        state,
      };
    }
    const ss = (input.planStepStatus ?? "").toUpperCase();
    if (ss === "BLOCKED" || ss === "CANCELLED") {
      return {
        ok: false,
        error: "plan_step_blocked",
        data: null,
        state,
      };
    }
  }

  if (
    input.sourceType === "accepted_recommendation" &&
    input.recommendationStatus &&
    input.recommendationStatus.toUpperCase() !== "ACCEPTED"
  ) {
    return {
      ok: false,
      error: "recommendation_not_accepted",
      data: null,
      state,
    };
  }

  const actionId =
    input.actionId ??
    mapStepTypeToAction(
      typeof input.input?.stepType === "string"
        ? input.input.stepType
        : undefined
    );

  if (isBlockedActionId(actionId)) {
    return { ok: false, error: "blocked_action", data: null, state };
  }

  const def = getAction(actionId);
  if (!def) {
    return { ok: false, error: "action_not_registered", data: null, state };
  }

  const payload = {
    title:
      input.title ??
      (typeof input.input?.title === "string"
        ? input.input.title
        : def.name),
    message:
      typeof input.input?.message === "string"
        ? input.input.message
        : input.description ?? `Automação: ${def.name}`,
    planId: input.planId ?? null,
    stepId: input.planStepId ?? null,
    ...input.input,
  };

  const idempotencyKey = [
    viewer.userId,
    actionId,
    input.planId ?? "",
    input.planStepId ?? "",
    input.sourceId ?? "",
    hashPayload(payload),
  ].join(":");

  if (next.idempotencyIndex[idempotencyKey]) {
    const existing = findAuto(next, next.idempotencyIndex[idempotencyKey]);
    if (existing) {
      return { ok: true, error: null, data: existing, state: next };
    }
  }

  const explain = buildExplainFields(input, actionId);
  const requiresConfirmation =
    def.requiresConfirmation ||
    settings.defaultAutonomyLevel === "SUGGEST" ||
    settings.defaultAutonomyLevel === "PREPARE" ||
    def.riskLevel === "MEDIUM" ||
    def.riskLevel === "HIGH" ||
    def.riskLevel === "CRITICAL";

  const auto: Automation = {
    id: newId("auto"),
    title: input.title ?? def.name,
    description: input.description ?? def.description,
    status: "PROPOSED",
    triggerType: input.triggerType,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    planId: input.planId ?? null,
    planStepId: input.planStepId ?? null,
    actionId,
    actionVersion: def.version,
    workspaceId: viewer.workspaceId,
    ownerId: viewer.userId,
    createdBy: viewer.userId,
    autonomyLevel: settings.defaultAutonomyLevel,
    riskLevel: def.riskLevel,
    reversibility: def.reversibility,
    input: payload,
    preparedOutput: null,
    executionResult: null,
    executionError: null,
    errorClass: null,
    idempotencyKey,
    cooldownKey: `${viewer.userId}:${actionId}`,
    scheduledFor: input.scheduledFor ?? null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    requiresConfirmation,
    confirmedBy: null,
    confirmedAt: null,
    confirmationToken: null,
    confirmationExpiresAt: null,
    confirmationPayloadHash: null,
    executedAt: null,
    undoneAt: null,
    undoToken: null,
    rowVersion: 1,
    leaseOwner: null,
    leaseExpiresAt: null,
    executionAttempt: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    nextRetryAt: null,
    context: viewer.workspaceId ? "workspace" : "personal",
    projectId: input.projectId ?? null,
    gateFailures: [],
    ...explain,
    executionInfluence: "proposed",
    softDeleted: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  next.automations.unshift(auto);
  next.idempotencyIndex[idempotencyKey] = auto.id;
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_created",
    summary: `Proposta: ${auto.title}`,
    metadata: {
      actionId,
      sanitizedInput: sanitizeActionInput(actionId, payload),
      executionInfluence: "proposed",
    },
  });

  // SUGGEST only presents — PREPARE+ can continue via prepareAutomation
  return { ok: true, error: null, data: auto, state: next };
}

export function prepareAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string,
  settings: AuraBrainSettings
): EngineResult<Automation> {
  ensureBuiltinActions();
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  if (
    !["PROPOSED", "DRAFT", "PREPARED", "BLOCKED", "FAILED"].includes(auto.status)
  ) {
    return {
      ok: false,
      error: `cannot_prepare_from_${auto.status}`,
      data: null,
      state,
    };
  }

  // SUGGEST may prepare a draft for display but never execute from prepare alone.

  const def = getAction(auto.actionId);
  if (!def) {
    const blocked = {
      ...auto,
      status: "BLOCKED" as const,
      gateFailures: ["action_not_registered"],
      updatedAt: nowIso(),
      rowVersion: auto.rowVersion + 1,
    };
    replaceAuto(next, blocked);
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_blocked",
      summary: "Ação não registrada",
      metadata: {},
    });
    return { ok: false, error: "action_not_registered", data: blocked, state: next };
  }

  const prepared = {
    prepared: true,
    actionId: auto.actionId,
    actionVersion: def.version,
    preview: sanitizeActionInput(auto.actionId, auto.input),
    willChange: auto.willChange,
    willNotChange: auto.willNotChange,
    riskLevel: def.riskLevel,
    reversibility: def.reversibility,
    requiresConfirmation: def.requiresConfirmation || auto.requiresConfirmation,
  };

  let status: AutomationStatus = "PREPARED";
  let executionInfluence: Automation["executionInfluence"] = "prepared";

  if (def.requiresConfirmation || auto.requiresConfirmation || settings.defaultAutonomyLevel === "CONFIRM") {
    status = "AWAITING_CONFIRMATION";
  }

  if (settings.defaultAutonomyLevel === "SUGGEST") {
    status = "PREPARED";
  }

  const updated: Automation = {
    ...auto,
    status,
    preparedOutput: prepared,
    executionInfluence,
    requiresConfirmation:
      def.requiresConfirmation || auto.requiresConfirmation,
    updatedAt: nowIso(),
    rowVersion: auto.rowVersion + 1,
  };

  replaceAuto(next, updated);
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_prepared",
    summary: `Preparada: ${auto.title}`,
    metadata: { prepared: sanitizeActionInput(auto.actionId, prepared) },
  });
  pushNotification(next, {
    userId: viewer.userId,
    automationId: auto.id,
    kind: "prepared",
    title: "Automação preparada",
    message: updated.title,
    href: `/dashboard/automations/${auto.id}`,
  });

  if (status === "AWAITING_CONFIRMATION") {
    const token = newId("cfm");
    const payloadHash = hashPayload(auto.input);
    const conf: AutomationConfirmation = {
      id: newId("conf"),
      automationId: auto.id,
      token,
      payloadHash,
      requestedBy: viewer.userId,
      confirmedBy: null,
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString(),
      confirmedAt: null,
      revoked: false,
      createdAt: nowIso(),
    };
    next.confirmations.unshift(conf);
    const awaiting: Automation = {
      ...updated,
      status: "AWAITING_CONFIRMATION",
      confirmationToken: token,
      confirmationExpiresAt: conf.expiresAt,
      confirmationPayloadHash: payloadHash,
      rowVersion: updated.rowVersion + 1,
      updatedAt: nowIso(),
    };
    replaceAuto(next, awaiting);
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_confirmation_requested",
      summary: "Confirmação solicitada",
      metadata: { expiresAt: conf.expiresAt },
    });
    pushNotification(next, {
      userId: viewer.userId,
      automationId: auto.id,
      kind: "awaiting_confirmation",
      title: "Aguardando confirmação",
      message: awaiting.title,
      href: `/dashboard/automations/${auto.id}`,
    });
    return { ok: true, error: null, data: awaiting, state: next };
  }

  return { ok: true, error: null, data: updated, state: next };
}

export function confirmAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string,
  confirmationToken: string,
  settings: AuraBrainSettings
): EngineResult<Automation> {
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  if (auto.status !== "AWAITING_CONFIRMATION" && auto.status !== "PREPARED") {
    return {
      ok: false,
      error: `cannot_confirm_from_${auto.status}`,
      data: null,
      state,
    };
  }

  const conf = next.confirmations.find(
    (c) =>
      c.automationId === automationId &&
      c.token === confirmationToken &&
      !c.revoked
  );
  if (!conf) {
    return { ok: false, error: "invalid_confirmation_token", data: null, state };
  }
  if (Date.parse(conf.expiresAt) < Date.now()) {
    const expired: Automation = {
      ...auto,
      status: "EXPIRED",
      updatedAt: nowIso(),
      rowVersion: auto.rowVersion + 1,
    };
    replaceAuto(next, expired);
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_expired",
      summary: "Confirmação expirada",
      metadata: {},
    });
    return { ok: false, error: "confirmation_expired", data: expired, state: next };
  }

  const currentHash = hashPayload(auto.input);
  if (conf.payloadHash !== currentHash) {
    return {
      ok: false,
      error: "confirmation_payload_mismatch",
      data: null,
      state,
    };
  }

  conf.confirmedBy = viewer.userId;
  conf.confirmedAt = nowIso();

  const updated: Automation = {
    ...auto,
    status: "APPROVED",
    confirmedBy: viewer.userId,
    confirmedAt: nowIso(),
    confirmationToken: conf.token,
    executionInfluence: "confirmed",
    updatedAt: nowIso(),
    rowVersion: auto.rowVersion + 1,
  };
  replaceAuto(next, updated);
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_confirmed",
    summary: "Confirmada pelo usuário",
    metadata: { autonomy: settings.defaultAutonomyLevel },
  });

  return { ok: true, error: null, data: updated, state: next };
}

export async function executeAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string,
  settings: AuraBrainSettings,
  opts?: {
    confirmed?: boolean;
    autoSafe?: boolean;
    leaseOwner?: string;
    forceManual?: boolean;
  }
): Promise<EngineResult<Automation>> {
  ensureBuiltinActions();
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  const allowedStatuses: AutomationStatus[] = [
    "APPROVED",
    "SCHEDULED",
    "PREPARED",
    "FAILED",
    "AWAITING_CONFIRMATION",
  ];
  if (!allowedStatuses.includes(auto.status) && !opts?.forceManual) {
    return {
      ok: false,
      error: `cannot_execute_from_${auto.status}`,
      data: null,
      state,
    };
  }

  const autoSafePath =
    Boolean(opts?.autoSafe) ||
    (settings.defaultAutonomyLevel === "AUTO_SAFE" &&
      !auto.requiresConfirmation &&
      auto.status !== "AWAITING_CONFIRMATION");

  const confirmed =
    Boolean(opts?.confirmed) ||
    Boolean(auto.confirmedAt) ||
    auto.status === "APPROVED";

  if (
    auto.requiresConfirmation &&
    !confirmed &&
    !autoSafePath
  ) {
    const blocked: Automation = {
      ...auto,
      status: "AWAITING_CONFIRMATION",
      gateFailures: ["confirmation_required"],
      updatedAt: nowIso(),
      rowVersion: auto.rowVersion + 1,
    };
    replaceAuto(next, blocked);
    return {
      ok: false,
      error: "confirmation_required",
      data: blocked,
      state: next,
    };
  }

  const gates = evaluateExecutionGates({
    automation: auto,
    settings,
    state: next,
    confirmed,
    autoSafePath,
  });

  if (!gates.ok) {
    const targetStatus: AutomationStatus =
      gates.failures.includes("confirmation_required")
        ? "AWAITING_CONFIRMATION"
        : "BLOCKED";
    const blocked: Automation = {
      ...auto,
      status: targetStatus,
      gateFailures: gates.failures,
      executionError: gates.failures.join(","),
      updatedAt: nowIso(),
      rowVersion: auto.rowVersion + 1,
    };
    replaceAuto(next, blocked);

    let auditAction: AutomationAuditAction = "automation_blocked";
    if (gates.failures.includes("quiet_hours_blocked"))
      auditAction = "quiet_hours_blocked";
    if (gates.failures.includes("daily_limit_reached"))
      auditAction = "limit_reached";
    if (gates.failures.includes("cooldown_active"))
      auditAction = "cooldown_active";

    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: auditAction,
      summary: `Bloqueada: ${gates.failures.join(", ")}`,
      metadata: { gates: gates.failures },
    });
    pushNotification(next, {
      userId: viewer.userId,
      automationId: auto.id,
      kind: "blocked",
      title: "Automação bloqueada",
      message: gates.failures.join(", "),
      href: `/dashboard/automations/${auto.id}`,
    });
    // Never silent fallback to execute
    return { ok: false, error: "gated", data: blocked, state: next };
  }

  const leaseOwner = opts?.leaseOwner ?? `user:${viewer.userId}`;
  const leased = acquireLease(auto, leaseOwner);
  if (!leased.ok) {
    return { ok: false, error: leased.reason, data: null, state };
  }

  replaceAuto(next, leased.automation);
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "lease_acquired",
    summary: `Lease ${leaseOwner}`,
    metadata: { leaseExpiresAt: leased.automation.leaseExpiresAt },
  });
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_started",
    summary: "Execução iniciada",
    metadata: {
      attempt: leased.automation.executionAttempt,
      autoSafe: autoSafePath,
    },
  });

  next.attempts.unshift({
    id: newId("att"),
    automationId: auto.id,
    attempt: leased.automation.executionAttempt,
    status: "STARTED",
    errorClass: null,
    error: null,
    leaseOwner,
    startedAt: nowIso(),
    finishedAt: null,
    outputSummary: {},
  });

  const def = getAction(auto.actionId)!;
  try {
    const result = await def.execute({
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      context: auto.context,
      input: auto.input,
      confirmed,
    });

    if (!result.ok) {
      const errClass = classifyError(result.error);
      let failed = releaseLease({
        ...leased.automation,
        status: "FAILED",
        executionError: result.error,
        errorClass: errClass,
        executionResult: result.output,
        updatedAt: nowIso(),
      });
      const attempt = next.attempts[0];
      attempt.status = "FAILED";
      attempt.error = result.error;
      attempt.errorClass = errClass;
      attempt.finishedAt = nowIso();

      pushAudit(next, {
        automationId: auto.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "automation_failed",
        summary: result.error ?? "falha",
        metadata: { errorClass: errClass },
      });
      pushAudit(next, {
        automationId: auto.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "lease_released",
        summary: "Lease liberado",
        metadata: {},
      });
      pushNotification(next, {
        userId: viewer.userId,
        automationId: auto.id,
        kind: "failed",
        title: "Automação falhou",
        message: result.error ?? "erro",
        href: `/dashboard/automations/${auto.id}`,
      });

      if (
        isRetryable(errClass) &&
        failed.executionAttempt < failed.maxAttempts
      ) {
        const backoff = Math.min(
          60_000,
          1000 * 2 ** failed.executionAttempt
        );
        failed = {
          ...failed,
          nextRetryAt: new Date(Date.now() + backoff).toISOString(),
          status: "SCHEDULED",
        };
        pushAudit(next, {
          automationId: auto.id,
          userId: viewer.userId,
          workspaceId: viewer.workspaceId,
          action: "automation_retry_scheduled",
          summary: `Retry em ${backoff}ms`,
          metadata: { nextRetryAt: failed.nextRetryAt },
        });
      }

      replaceAuto(next, failed);
      return { ok: false, error: result.error, data: failed, state: next };
    }

    const succeeded = releaseLease({
      ...leased.automation,
      status: "SUCCEEDED",
      executionResult: sanitizeActionInput(auto.actionId, result.output),
      executionError: null,
      errorClass: null,
      executedAt: nowIso(),
      undoToken: result.undoToken ?? null,
      executionInfluence: autoSafePath ? "auto_safe" : "executed",
      gateFailures: [],
      updatedAt: nowIso(),
    });
    replaceAuto(next, succeeded);
    next.cooldownIndex[auto.cooldownKey] = nowIso();
    bumpDailyCount(next, viewer.userId);

    const attempt = next.attempts[0];
    attempt.status = "SUCCEEDED";
    attempt.finishedAt = nowIso();
    attempt.outputSummary = succeeded.executionResult ?? {};

    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_succeeded",
      summary: "Executada com sucesso",
      metadata: {
        output: succeeded.executionResult,
        executionInfluence: succeeded.executionInfluence,
      },
    });
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "lease_released",
      summary: "Lease liberado",
      metadata: {},
    });
    pushNotification(next, {
      userId: viewer.userId,
      automationId: auto.id,
      kind: "executed",
      title: "Automação executada",
      message: succeeded.title,
      href: `/dashboard/automations/${auto.id}`,
    });

    return { ok: true, error: null, data: succeeded, state: next };
  } catch (e) {
    const message = e instanceof Error ? e.message : "execution_error";
    const errClass: AutomationErrorClass = classifyError(message);
    const failed = releaseLease({
      ...leased.automation,
      status: "FAILED",
      executionError: message,
      errorClass: errClass,
      updatedAt: nowIso(),
    });
    replaceAuto(next, failed);
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_failed",
      summary: message,
      metadata: { errorClass: errClass },
    });
    return { ok: false, error: message, data: failed, state: next };
  }
}

export function scheduleAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string,
  scheduledFor: string
): EngineResult<Automation> {
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  if (Date.parse(scheduledFor) <= Date.now()) {
    return { ok: false, error: "scheduled_for_must_be_future", data: null, state };
  }

  const updated: Automation = {
    ...auto,
    status: "SCHEDULED",
    scheduledFor,
    updatedAt: nowIso(),
    rowVersion: auto.rowVersion + 1,
  };
  replaceAuto(next, updated);
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_scheduled",
    summary: `Agendada para ${scheduledFor}`,
    metadata: { scheduledFor },
  });
  pushNotification(next, {
    userId: viewer.userId,
    automationId: auto.id,
    kind: "scheduled",
    title: "Automação agendada",
    message: `${updated.title} · ${scheduledFor}`,
    href: `/dashboard/automations/${auto.id}`,
  });
  return { ok: true, error: null, data: updated, state: next };
}

export function cancelAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string
): EngineResult<Automation> {
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  if (["SUCCEEDED", "UNDONE", "RUNNING"].includes(auto.status)) {
    return {
      ok: false,
      error: `cannot_cancel_${auto.status}`,
      data: null,
      state,
    };
  }

  const updated: Automation = {
    ...auto,
    status: "CANCELLED",
    updatedAt: nowIso(),
    rowVersion: auto.rowVersion + 1,
  };
  replaceAuto(next, updated);

  for (const c of next.confirmations) {
    if (c.automationId === automationId && !c.confirmedAt) c.revoked = true;
  }

  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_cancelled",
    summary: "Cancelada",
    metadata: {},
  });
  return { ok: true, error: null, data: updated, state: next };
}

export async function retryAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string,
  settings: AuraBrainSettings
): Promise<EngineResult<Automation>> {
  const auto = findAuto(state, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  if (auto.status !== "FAILED" && auto.status !== "BLOCKED") {
    return { ok: false, error: "retry_only_failed_or_blocked", data: null, state };
  }
  if (auto.errorClass && !isRetryable(auto.errorClass) && auto.status === "FAILED") {
    if (auto.errorClass === "NON_RETRYABLE" || auto.errorClass === "VALIDATION" || auto.errorClass === "PERMISSION") {
      return { ok: false, error: "non_retryable", data: null, state };
    }
  }
  if (auto.executionAttempt >= auto.maxAttempts) {
    return { ok: false, error: "max_attempts_reached", data: null, state };
  }

  const next = cloneState(state);
  const reset: Automation = {
    ...auto,
    status: "APPROVED",
    executionError: null,
    gateFailures: [],
    updatedAt: nowIso(),
    rowVersion: auto.rowVersion + 1,
  };
  replaceAuto(next, reset);
  pushAudit(next, {
    automationId: auto.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "automation_retry_scheduled",
    summary: "Retry manual",
    metadata: { attempt: auto.executionAttempt + 1 },
  });

  return executeAutomationPure(next, viewer, automationId, settings, {
    confirmed: Boolean(auto.confirmedAt),
    forceManual: true,
  });
}

export async function undoAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  automationId: string
): Promise<EngineResult<Automation>> {
  ensureBuiltinActions();
  const next = cloneState(state);
  const auto = findAuto(next, automationId);
  if (!auto) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutate(viewer, auto);
  if (!mut.ok) return { ok: false, error: mut.reason, data: null, state };

  if (auto.status !== "SUCCEEDED") {
    return { ok: false, error: "undo_only_succeeded", data: null, state };
  }
  if (auto.reversibility === "none") {
    return { ok: false, error: "not_reversible", data: null, state };
  }
  if (
    auto.executedAt &&
    Date.now() - Date.parse(auto.executedAt) > UNDO_WINDOW_MS
  ) {
    return { ok: false, error: "undo_window_expired", data: null, state };
  }

  const def = getAction(auto.actionId);
  if (!def?.undo) {
    return { ok: false, error: "undo_not_supported", data: null, state };
  }

  // Conflict: if row was mutated after success with higher version markers in result
  if (auto.executionResult?.mutatedAfter === true) {
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_undo_failed",
      summary: "Conflito: estado alterado posteriormente",
      metadata: {},
    });
    return { ok: false, error: "undo_conflict", data: null, state: next };
  }

  const expected = auto.rowVersion;
  try {
    const result = await def.undo({
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      context: auto.context,
      input: {
        ...auto.input,
        ...auto.executionResult,
        notificationId:
          auto.executionResult?.notificationId ?? auto.undoToken,
        undoToken: auto.undoToken,
      },
      confirmed: true,
    });
    if (!result.ok) {
      pushAudit(next, {
        automationId: auto.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "automation_undo_failed",
        summary: result.error ?? "undo_failed",
        metadata: {},
      });
      return { ok: false, error: result.error, data: null, state: next };
    }

    const patched = conditionalUpdate(auto, expected, {
      status: "UNDONE",
      undoneAt: nowIso(),
      executionResult: {
        ...(auto.executionResult ?? {}),
        undo: result.output,
      },
    });
    if (!patched.ok) {
      return { ok: false, error: patched.reason, data: null, state: next };
    }
    replaceAuto(next, patched.automation);
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_undone",
      summary: "Desfeita",
      metadata: { output: result.output },
    });
    pushNotification(next, {
      userId: viewer.userId,
      automationId: auto.id,
      kind: "undone",
      title: "Automação desfeita",
      message: auto.title,
      href: `/dashboard/automations/${auto.id}`,
    });
    return { ok: true, error: null, data: patched.automation, state: next };
  } catch (e) {
    const message = e instanceof Error ? e.message : "undo_failed";
    pushAudit(next, {
      automationId: auto.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "automation_undo_failed",
      summary: message,
      metadata: {},
    });
    return { ok: false, error: message, data: null, state: next };
  }
}

export function listAutomationsPure(
  state: AutomationState,
  viewer: AutomationViewer,
  filters: AutomationListFilters = {}
): Automation[] {
  let items = state.automations.filter(
    (a) => !a.softDeleted && canView(viewer, a)
  );

  const statuses = filters.status
    ? Array.isArray(filters.status)
      ? filters.status
      : [filters.status]
    : null;
  if (statuses) items = items.filter((a) => statuses.includes(a.status));

  if (filters.actionId)
    items = items.filter((a) => a.actionId === filters.actionId);

  const risks = filters.riskLevel
    ? Array.isArray(filters.riskLevel)
      ? filters.riskLevel
      : [filters.riskLevel]
    : null;
  if (risks) items = items.filter((a) => risks.includes(a.riskLevel));

  const automs = filters.autonomyLevel
    ? Array.isArray(filters.autonomyLevel)
      ? filters.autonomyLevel
      : [filters.autonomyLevel]
    : null;
  if (automs) items = items.filter((a) => automs.includes(a.autonomyLevel));

  if (filters.projectId)
    items = items.filter((a) => a.projectId === filters.projectId);
  if (filters.planId) items = items.filter((a) => a.planId === filters.planId);
  if (filters.ownerId)
    items = items.filter((a) => a.ownerId === filters.ownerId);
  if (filters.workspaceId !== undefined)
    items = items.filter((a) => a.workspaceId === filters.workspaceId);
  if (filters.from)
    items = items.filter((a) => a.createdAt >= filters.from!);
  if (filters.to) items = items.filter((a) => a.createdAt <= filters.to!);

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  return items.slice(offset, offset + limit);
}

export function getAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  id: string
): Automation | null {
  const auto = findAuto(state, id);
  if (!auto || !canView(viewer, auto)) return null;
  return auto;
}

export function explainAutomationPure(
  state: AutomationState,
  viewer: AutomationViewer,
  id: string
): AutomationExplanation | null {
  const auto = getAutomationPure(state, viewer, id);
  if (!auto) return null;
  return {
    automationId: auto.id,
    title: auto.title,
    why: auto.explainSummary,
    source: { type: auto.sourceType, id: auto.sourceId },
    planId: auto.planId,
    planStepId: auto.planStepId,
    recommendationId:
      auto.sourceType === "accepted_recommendation" ? auto.sourceId : null,
    evidence: auto.evidence,
    actionId: auto.actionId,
    gates: [
      "action_registered",
      "ownership",
      "workspace",
      "risk",
      "autonomy",
      "cooldown",
      "daily_limit",
      "quiet_hours",
      "idempotency",
      "no_external_comm",
      "no_deletion",
      "no_payment",
    ],
    gateFailures: auto.gateFailures,
    riskLevel: auto.riskLevel,
    autonomyLevel: auto.autonomyLevel,
    limitations: auto.limitations,
    willChange: auto.willChange,
    willNotChange: auto.willNotChange,
    executionInfluence: auto.executionInfluence,
  };
}

export function getHomeAutomationWidgetPure(
  state: AutomationState,
  viewer: AutomationViewer,
  now = new Date()
): AutomationHomeWidget {
  const items = listAutomationsPure(state, viewer, { limit: 500 });
  const day = now.toISOString().slice(0, 10);

  return {
    awaitingConfirmation: items
      .filter((a) => a.status === "AWAITING_CONFIRMATION")
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        riskLevel: a.riskLevel,
      })),
    scheduledToday: items
      .filter(
        (a) =>
          a.status === "SCHEDULED" &&
          a.scheduledFor &&
          a.scheduledFor.startsWith(day)
      )
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        scheduledFor: a.scheduledFor!,
      })),
    executedToday: items
      .filter(
        (a) =>
          a.status === "SUCCEEDED" &&
          a.executedAt &&
          a.executedAt.startsWith(day)
      )
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        executedAt: a.executedAt!,
      })),
    failed: items
      .filter((a) => a.status === "FAILED")
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        error: a.executionError,
      })),
    blocked: items
      .filter((a) => a.status === "BLOCKED")
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title,
        reason: a.gateFailures.join(", ") || a.executionError || "blocked",
      })),
  };
}

export async function processEligibleAutomationsPure(
  state: AutomationState,
  viewer: AutomationViewer,
  settings: AuraBrainSettings,
  opts?: { limit?: number; leaseOwner?: string; now?: Date }
): Promise<{
  processed: number;
  results: Array<{ id: string; ok: boolean; error: string | null }>;
  state: AutomationState;
}> {
  const limit = Math.min(opts?.limit ?? 1, 5);
  const now = opts?.now ?? new Date();
  let current = cloneState(state);
  const results: Array<{ id: string; ok: boolean; error: string | null }> = [];

  if (!settings.automationsEnabled) {
    return { processed: 0, results: [], state: current };
  }
  if (
    (settings as AuraBrainSettings & { pauseAllAutomations?: boolean })
      .pauseAllAutomations
  ) {
    return { processed: 0, results: [], state: current };
  }

  const eligible = listAutomationsPure(current, viewer, { limit: 100 }).filter(
    (a) => {
      if (a.status === "SCHEDULED" && a.scheduledFor) {
        return Date.parse(a.scheduledFor) <= now.getTime();
      }
      if (
        a.status === "APPROVED" &&
        settings.defaultAutonomyLevel === "AUTO_SAFE" &&
        !a.requiresConfirmation
      ) {
        return true;
      }
      if (
        a.status === "SCHEDULED" &&
        a.nextRetryAt &&
        Date.parse(a.nextRetryAt) <= now.getTime()
      ) {
        return true;
      }
      return false;
    }
  );

  for (const auto of eligible.slice(0, limit)) {
    const res = await executeAutomationPure(
      current,
      viewer,
      auto.id,
      settings,
      {
        autoSafe: settings.defaultAutonomyLevel === "AUTO_SAFE",
        confirmed: Boolean(auto.confirmedAt),
        leaseOwner: opts?.leaseOwner ?? "worker:batch",
        forceManual: true,
      }
    );
    current = res.state;
    results.push({ id: auto.id, ok: res.ok, error: res.error });
  }

  return { processed: results.length, results, state: current };
}

export function revokePendingConfirmationsPure(
  state: AutomationState,
  viewer: AutomationViewer
): AutomationState {
  const next = cloneState(state);
  for (const c of next.confirmations) {
    if (!c.confirmedAt && !c.revoked) {
      const auto = findAuto(next, c.automationId);
      if (auto && canMutate(viewer, auto).ok) {
        c.revoked = true;
      }
    }
  }
  for (const a of next.automations) {
    if (
      a.status === "AWAITING_CONFIRMATION" &&
      canMutate(viewer, a).ok
    ) {
      replaceAuto(next, {
        ...a,
        status: "CANCELLED",
        confirmationToken: null,
        updatedAt: nowIso(),
        rowVersion: a.rowVersion + 1,
      });
    }
  }
  return next;
}

function cloneState(state: AutomationState): AutomationState {
  return {
    automations: state.automations.map((a) => ({ ...a })),
    attempts: state.attempts.map((a) => ({ ...a })),
    confirmations: state.confirmations.map((c) => ({ ...c })),
    audits: state.audits.map((a) => ({ ...a })),
    notifications: state.notifications.map((n) => ({ ...n })),
    idempotencyIndex: { ...state.idempotencyIndex },
    cooldownIndex: { ...state.cooldownIndex },
    dailyCounts: { ...state.dailyCounts },
  };
}

export { canView as canViewAutomation, canMutate as canMutateAutomation };
export { cooldownActive };
