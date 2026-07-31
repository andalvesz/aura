/**
 * Agent Runtime orchestrator — controlled execution loop.
 * Objective → context → plan → registered actions → confirm/AUTO_SAFE → verify → audit.
 */

import { getAction } from "@/lib/aura-brain/actions/registry";
import {
  DEFAULT_AURA_BRAIN_SETTINGS,
  type AuraBrainSettings,
} from "@/lib/aura-brain/types";
import { formatBudgetReport, checkBudgets } from "@/lib/agent-runtime/budget";
import {
  alreadyExecuted,
  buildCheckpoint,
} from "@/lib/agent-runtime/checkpoints";
import {
  buildAgentContext,
  sanitizeContextAgainstInjection,
} from "@/lib/agent-runtime/context-builder";
import {
  canConfirmSession,
  canMutateSession,
  canViewSession,
  evaluateStepPolicy,
} from "@/lib/agent-runtime/policy-engine";
import { suggestNextStep } from "@/lib/agent-runtime/provider";
import {
  acquireSessionLease,
  classifyRecovery,
  releaseSessionLease,
  statusAfterRecovery,
} from "@/lib/agent-runtime/recovery";
import {
  ensureBuiltinAgents,
  getAgentDefinition,
  isActionAllowedForAgent,
} from "@/lib/agent-runtime/registry";
import {
  cloneAgentState,
  hashPayload,
  newId,
  nowIso,
} from "@/lib/agent-runtime/store";
import { invokeAgentTool, rejectClientProvidedTools } from "@/lib/agent-runtime/tools/boundary";
import { verifyStepResult } from "@/lib/agent-runtime/verification";
import {
  CONFIRMATION_TTL_MS,
  DEFAULT_SESSION_TTL_MS,
  type AgentAuditAction,
  type AgentAuditEntry,
  type AgentExplanation,
  type AgentHomeWidget,
  type AgentNotification,
  type AgentSession,
  type AgentState,
  type AgentStep,
  type AgentViewer,
  type RunAgentSessionInput,
} from "@/lib/agent-runtime/types";

export type RuntimeResult<T> = {
  ok: boolean;
  error: string | null;
  data: T | null;
  state: AgentState;
};

function pushAudit(
  state: AgentState,
  entry: Omit<AgentAuditEntry, "id" | "createdAt">
): void {
  state.audits.unshift({
    id: newId("aaud"),
    createdAt: nowIso(),
    ...entry,
  });
}

function pushNotification(
  state: AgentState,
  n: Omit<AgentNotification, "id" | "createdAt" | "read">
): void {
  state.notifications.unshift({
    id: newId("anot"),
    createdAt: nowIso(),
    read: false,
    ...n,
  });
}

function findSession(state: AgentState, id: string): AgentSession | undefined {
  return state.sessions.find((s) => s.id === id && !s.softDeleted);
}

function replaceSession(state: AgentState, session: AgentSession): void {
  const i = state.sessions.findIndex((s) => s.id === session.id);
  if (i >= 0) state.sessions[i] = session;
  else state.sessions.unshift(session);
}

function sessionSteps(state: AgentState, sessionId: string): AgentStep[] {
  return state.steps
    .filter((s) => s.sessionId === sessionId)
    .sort((a, b) => a.index - b.index);
}

function replaceStep(state: AgentState, step: AgentStep): void {
  const i = state.steps.findIndex((s) => s.id === step.id);
  if (i >= 0) state.steps[i] = step;
  else state.steps.push(step);
}

function mapAgentDefaultAction(agentId: string, objective: string): string {
  switch (agentId) {
    case "plan_assistant_v1":
      return "create_plan_review_reminder";
    case "project_review_v1":
      return "create_internal_notification";
    case "knowledge_organizer_v1":
      return "create_content_idea_draft";
    case "business_preparation_v1":
      return "create_business_idea_draft";
    default:
      return objective.toLowerCase().includes("tarefa")
        ? "create_personal_task_draft"
        : "create_internal_notification";
  }
}

function buildStepsFromContext(
  session: AgentSession,
  agentId: string
): AgentStep[] {
  const plan = session.contextSnapshot?.plans.find((p) => p.id === session.planId);
  const steps: AgentStep[] = [];
  if (plan?.steps?.length) {
    const eligible = plan.steps.filter(
      (s) => !["COMPLETED", "CANCELLED", "BLOCKED"].includes(s.status.toUpperCase())
    );
    for (const [i, ps] of eligible.slice(0, session.stepBudget).entries()) {
      const actionId =
        agentId === "plan_assistant_v1"
          ? mapAgentDefaultAction(agentId, ps.title)
          : mapAgentDefaultAction(agentId, session.objective);
      steps.push({
        id: newId("astep"),
        sessionId: session.id,
        index: i,
        title: ps.title,
        planStepId: ps.id,
        actionId,
        status: "PENDING",
        input: {
          title: ps.title,
          message: ps.description ?? ps.title,
          planId: plan.id,
          stepId: ps.id,
        },
        preparedOutput: null,
        executionResult: null,
        verification: null,
        error: null,
        idempotencyKey: `${session.id}:${ps.id}:${actionId}`,
        requiresConfirmation: true,
        confirmationToken: null,
        confirmationExpiresAt: null,
        confirmationPayloadHash: null,
        question: null,
        userAnswer: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  if (!steps.length) {
    const actionId = mapAgentDefaultAction(agentId, session.objective);
    steps.push({
      id: newId("astep"),
      sessionId: session.id,
      index: 0,
      title: session.objective,
      planStepId: null,
      actionId,
      status: "PENDING",
      input: {
        title: session.objective.slice(0, 80),
        message: session.objective,
        ...(actionId.includes("business")
          ? { title: session.objective.slice(0, 80) }
          : {}),
      },
      preparedOutput: null,
      executionResult: null,
      verification: null,
      error: null,
      idempotencyKey: `${session.id}:root:${actionId}`,
      requiresConfirmation: true,
      confirmationToken: null,
      confirmationExpiresAt: null,
      confirmationPayloadHash: null,
      question:
        agentId === "business_preparation_v1"
          ? "Qual hipótese de negócio estruturar?"
          : null,
      userAnswer: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  return steps;
}

export function createAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  input: RunAgentSessionInput,
  brainSettings: AuraBrainSettings = {
    ...DEFAULT_AURA_BRAIN_SETTINGS,
    userId: viewer.userId,
    updatedAt: nowIso(),
  },
  opts?: { clientTools?: unknown }
): RuntimeResult<AgentSession> {
  ensureBuiltinAgents();
  const next = cloneAgentState(state);

  const toolsCheck = rejectClientProvidedTools(opts?.clientTools);
  if (!toolsCheck.ok) {
    return { ok: false, error: toolsCheck.reason, data: null, state };
  }

  if (next.settings.pauseAllAgents) {
    return { ok: false, error: "agents_paused", data: null, state };
  }

  const agent = getAgentDefinition(input.agentId);
  if (!agent) {
    return { ok: false, error: "agent_not_registered", data: null, state };
  }

  const agentSettings = next.settings.perAgent[agent.id];
  if (agentSettings?.enabled !== true) {
    return { ok: false, error: "agent_disabled", data: null, state };
  }

  if (agent.requiresApprovedPlan) {
    const ps = (input.planStatus ?? "").toUpperCase();
    if (!input.planId || !["APPROVED", "IN_PROGRESS"].includes(ps)) {
      return { ok: false, error: "plan_not_approved", data: null, state };
    }
  }

  const autonomy =
    input.autonomyLevel ??
    agentSettings?.maxAutonomyLevel ??
    brainSettings.defaultAutonomyLevel;

  if (!agent.supportedAutonomyLevels.includes(autonomy)) {
    return { ok: false, error: "autonomy_not_supported", data: null, state };
  }

  let ctx = buildAgentContext({
    agent,
    partial: input.context,
  });
  ctx = sanitizeContextAgainstInjection(ctx);

  const session: AgentSession = {
    id: newId("asess"),
    agentId: agent.id,
    agentVersion: agent.version,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    ownerId: viewer.userId,
    objective: input.objective.slice(0, 500),
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    planId: input.planId ?? null,
    projectId: input.projectId ?? null,
    status: "READY",
    autonomyLevel: autonomy,
    riskCeiling: agent.maximumRiskLevel,
    stepBudget: Math.min(
      agent.maximumSteps,
      agentSettings?.stepLimit ?? agent.maximumSteps
    ),
    actionBudget: Math.min(
      agent.maximumActions,
      agentSettings?.actionLimit ?? agent.maximumActions
    ),
    timeBudgetMs: agent.maximumDurationMs,
    stepsUsed: 0,
    actionsUsed: 0,
    retriesUsed: 0,
    contextSnapshot: ctx,
    currentStepId: null,
    checkpoint: null,
    result: null,
    report: null,
    error: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL_MS).toISOString(),
    rowVersion: 1,
    softDeleted: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const steps = buildStepsFromContext(session, agent.id);
  // Business agent may wait for input first
  if (steps[0]?.question && !steps[0].userAnswer) {
    steps[0].status = "WAITING_INPUT";
    session.status = "WAITING_INPUT";
    session.currentStepId = steps[0].id;
  } else {
    session.currentStepId = steps[0]?.id ?? null;
  }

  next.sessions.unshift(session);
  for (const s of steps) next.steps.push(s);
  session.checkpoint = buildCheckpoint(session, steps);
  replaceSession(next, session);

  pushAudit(next, {
    sessionId: session.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "session_created",
    summary: `Sessão ${agent.name}: ${session.objective}`,
    metadata: { agentId: agent.id, planId: session.planId },
  });
  pushAudit(next, {
    sessionId: session.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "context_built",
    summary: `Contexto v${ctx.version}`,
    metadata: { items: agent.contextBudget, version: ctx.version },
  });

  if (session.status === "WAITING_INPUT") {
    pushNotification(next, {
      userId: viewer.userId,
      sessionId: session.id,
      kind: "needs_input",
      title: "Agente precisa de informação",
      message: steps[0]?.question ?? "Informação necessária",
      href: `/dashboard/agents/${session.id}`,
    });
    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "input_requested",
      summary: steps[0]?.question ?? "input",
      metadata: {},
    });
  }

  return { ok: true, error: null, data: session, state: next };
}

/** Enable agent in settings (required before create in production defaults) */
export function enableAgentPure(
  state: AgentState,
  agentId: import("@/lib/agent-runtime/types").AgentId,
  partial?: Partial<import("@/lib/agent-runtime/types").AgentSettings>
): AgentState {
  ensureBuiltinAgents();
  const next = cloneAgentState(state);
  const agent = getAgentDefinition(agentId);
  next.settings.perAgent[agentId] = {
    agentId,
    enabled: true,
    maxAutonomyLevel: partial?.maxAutonomyLevel ?? "PREPARE",
    allowedActionIds: partial?.allowedActionIds ?? agent?.allowedActionIds ?? [],
    allowedProjectIds: partial?.allowedProjectIds ?? [],
    allowedWorkspaceIds: partial?.allowedWorkspaceIds ?? [],
    stepLimit: partial?.stepLimit ?? agent?.maximumSteps ?? 5,
    actionLimit: partial?.actionLimit ?? agent?.maximumActions ?? 3,
    dailyLimit: partial?.dailyLimit ?? 10,
    quietHours: partial?.quietHours ?? null,
    requireConfirmation: partial?.requireConfirmation ?? true,
  };
  return next;
}

export async function runAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  sessionId: string,
  brainSettings: AuraBrainSettings,
  opts?: {
    maxLoop?: number;
    leaseOwner?: string;
    confirmed?: boolean;
    confirmationToken?: string;
  }
): Promise<RuntimeResult<AgentSession>> {
  ensureBuiltinAgents();
  let next = cloneAgentState(state);
  let session = findSession(next, sessionId);
  if (!session) return { ok: false, error: "not_found", data: null, state };

  const mut = canMutateSession(viewer, session);
  if (!mut.ok) {
    return { ok: false, error: mut.failures[0] ?? "forbidden", data: null, state };
  }

  const agent = getAgentDefinition(session.agentId);
  if (!agent) {
    return { ok: false, error: "agent_not_registered", data: null, state };
  }
  if (agent.version !== session.agentVersion) {
    return { ok: false, error: "incompatible_agent_version", data: null, state };
  }

  if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(session.status)) {
    return { ok: false, error: `cannot_run_${session.status}`, data: null, state };
  }

  const leaseOwner = opts?.leaseOwner ?? `user:${viewer.userId}`;
  const leased = acquireSessionLease(
    {
      ...session,
      startedAt: session.startedAt ?? nowIso(),
      status:
        session.status === "PAUSED" ||
        session.status === "READY" ||
        session.status === "DRAFT"
          ? "RUNNING"
          : session.status,
    },
    leaseOwner
  );
  if (!leased.ok) {
    return { ok: false, error: leased.reason, data: null, state };
  }
  session = leased.session;
  replaceSession(next, session);
  pushAudit(next, {
    sessionId: session.id,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "lease_acquired",
    summary: leaseOwner,
    metadata: { leaseExpiresAt: session.leaseExpiresAt },
  });
  if (!state.sessions.find((s) => s.id === sessionId)?.startedAt) {
    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "session_started",
      summary: "Sessão iniciada",
      metadata: {},
    });
  }

  const maxLoop = Math.min(opts?.maxLoop ?? session.stepBudget, session.stepBudget, 8);
  let loops = 0;

  while (loops < maxLoop) {
    loops += 1;
    session = findSession(next, sessionId)!;

    if (session.status === "WAITING_CONFIRMATION" || session.status === "WAITING_INPUT") {
      break;
    }

    const budget = checkBudgets(session);
    if (!budget.ok) {
      session = releaseSessionLease({
        ...session,
        status: "PARTIAL",
        error: budget.failures.join(","),
        completedAt: nowIso(),
        report: `Parcial: orçamento excedido (${budget.failures.join(", ")})`,
      });
      replaceSession(next, session);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "budget_exceeded",
        summary: budget.failures.join(","),
        metadata: formatBudgetReport(session),
      });
      pushNotification(next, {
        userId: viewer.userId,
        sessionId: session.id,
        kind: "budget_exceeded",
        title: "Limite do agente atingido",
        message: budget.failures.join(", "),
        href: `/dashboard/agents/${session.id}`,
      });
      break;
    }

    const steps = sessionSteps(next, session.id);
    const pending = steps.find(
      (s) =>
        s.status === "PENDING" ||
        s.status === "PREPARED" ||
        (s.status === "WAITING_CONFIRMATION" && opts?.confirmed)
    );

    if (!pending) {
      const verified = steps.filter((s) => s.status === "VERIFIED");
      const failed = steps.filter((s) => s.status === "FAILED");
      const status =
        failed.length && verified.length
          ? "PARTIAL"
          : failed.length
            ? "FAILED"
            : "COMPLETED";
      session = releaseSessionLease({
        ...session,
        status,
        completedAt: nowIso(),
        checkpoint: buildCheckpoint(session, steps),
        report: buildReport(session, steps, agent.name),
        result: {
          verified: verified.length,
          failed: failed.length,
          actions: session.actionsUsed,
        },
      });
      replaceSession(next, session);
      const auditAction: AgentAuditAction =
        status === "COMPLETED"
          ? "session_completed"
          : status === "PARTIAL"
            ? "session_partial"
            : "session_failed";
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: auditAction,
        summary: session.report ?? status,
        metadata: session.result ?? {},
      });
      pushNotification(next, {
        userId: viewer.userId,
        sessionId: session.id,
        kind:
          status === "COMPLETED"
            ? "completed"
            : status === "PARTIAL"
              ? "partial"
              : "failed",
        title: `Sessão ${status.toLowerCase()}`,
        message: session.objective,
        href: `/dashboard/agents/${session.id}`,
      });
      break;
    }

    // Resume: skip already executed idempotency
    if (
      alreadyExecuted(session.checkpoint, pending.idempotencyKey) &&
      (pending.status === "VERIFIED" || pending.status === "EXECUTED")
    ) {
      continue;
    }

    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "step_selected",
      summary: pending.title,
      metadata: { stepId: pending.id, actionId: pending.actionId },
    });

    const suggestion = suggestNextStep({
      agent,
      objective: session.objective,
      pendingSteps: [pending],
      allowedActionIds: agent.allowedActionIds,
    });
    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "provider_invoked",
      summary: suggestion.explanation,
      metadata: {
        source: suggestion.source,
        nextActionId: suggestion.nextActionId,
      },
    });

    if (
      suggestion.nextActionId &&
      isActionAllowedForAgent(agent, suggestion.nextActionId)
    ) {
      pending.actionId = suggestion.nextActionId;
    }

    if (!pending.actionId || !isActionAllowedForAgent(agent, pending.actionId)) {
      pending.status = "BLOCKED";
      pending.error = "action_not_allowed";
      replaceStep(next, pending);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "policy_blocked",
        summary: "action_not_allowed",
        metadata: {},
      });
      session = releaseSessionLease({
        ...session,
        status: "BLOCKED",
        error: "action_not_allowed",
      });
      replaceSession(next, session);
      break;
    }

    const plan = session.contextSnapshot?.plans.find(
      (p) => p.id === session!.planId
    );
    const policy = evaluateStepPolicy({
      agent,
      session,
      step: pending,
      viewer,
      brainSettings,
      runtimeSettings: next.settings,
      planStatus: plan?.status,
      planRowVersion: plan?.rowVersion,
      expectedPlanVersion: session.checkpoint?.planVersion,
    });

    if (!policy.ok) {
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "policy_blocked",
        summary: policy.failures.join(","),
        metadata: { failures: policy.failures },
      });
      pending.status = "BLOCKED";
      pending.error = policy.failures.join(",");
      replaceStep(next, pending);
      session = releaseSessionLease({
        ...session,
        status: "BLOCKED",
        error: policy.failures.join(","),
        checkpoint: buildCheckpoint(session, sessionSteps(next, session.id)),
      });
      replaceSession(next, session);
      break;
    }

    // SUGGEST: prepare only, stop
    if (session.autonomyLevel === "SUGGEST") {
      pending.status = "PREPARED";
      pending.preparedOutput = {
        preview: pending.input,
        actionId: pending.actionId,
        explanation: suggestion.explanation,
      };
      replaceStep(next, { ...pending, updatedAt: nowIso() });
      session = releaseSessionLease({
        ...session,
        status: "PARTIAL",
        stepsUsed: session.stepsUsed + 1,
        report: `SUGGEST: preparado sem executar — ${pending.title}`,
        checkpoint: buildCheckpoint(session, sessionSteps(next, session.id)),
        completedAt: nowIso(),
      });
      replaceSession(next, session);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "action_prepared",
        summary: pending.title,
        metadata: { mode: "SUGGEST" },
      });
      break;
    }

    // Prepare
    const def = getAction(pending.actionId)!;
    pending.preparedOutput = {
      preview: pending.input,
      actionId: pending.actionId,
      risk: def.riskLevel,
      reversibility: def.reversibility,
      explanation: suggestion.explanation,
    };
    pending.status = "PREPARED";
    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "action_prepared",
      summary: pending.title,
      metadata: { actionId: pending.actionId },
    });

    // PREPARE: draft only, never execute in this tick
    if (session.autonomyLevel === "PREPARE") {
      pending.status = "PREPARED";
      replaceStep(next, { ...pending, updatedAt: nowIso() });
      session = releaseSessionLease({
        ...session,
        status: "PARTIAL",
        stepsUsed: session.stepsUsed + 1,
        report: `PREPARE: rascunho pronto sem executar — ${pending.title}`,
        checkpoint: buildCheckpoint(session, sessionSteps(next, session.id)),
        completedAt: nowIso(),
      });
      replaceSession(next, session);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "action_prepared",
        summary: pending.title,
        metadata: { mode: "PREPARE" },
      });
      break;
    }

    const needsConfirm =
      def.requiresConfirmation ||
      session.autonomyLevel === "CONFIRM" ||
      next.settings.perAgent[agent.id]?.requireConfirmation === true;

    const autoSafe =
      session.autonomyLevel === "AUTO_SAFE" &&
      next.settings.allowAutoSafe &&
      def.riskLevel === "LOW" &&
      def.autoSafeEligible &&
      !def.requiresConfirmation;

    if (needsConfirm && !autoSafe && !opts?.confirmed) {
      const token = newId("acfm");
      const payloadHash = hashPayload(pending.input);
      pending.status = "WAITING_CONFIRMATION";
      pending.requiresConfirmation = true;
      pending.confirmationToken = token;
      pending.confirmationExpiresAt = new Date(
        Date.now() + CONFIRMATION_TTL_MS
      ).toISOString();
      pending.confirmationPayloadHash = payloadHash;
      replaceStep(next, { ...pending, updatedAt: nowIso() });

      next.confirmations.unshift({
        id: newId("aconf"),
        sessionId: session.id,
        stepId: pending.id,
        token,
        payloadHash,
        requestedBy: viewer.userId,
        confirmedBy: null,
        expiresAt: pending.confirmationExpiresAt,
        confirmedAt: null,
        revoked: false,
        createdAt: nowIso(),
      });

      session = releaseSessionLease({
        ...session,
        status: "WAITING_CONFIRMATION",
        currentStepId: pending.id,
        stepsUsed: session.stepsUsed + 1,
        checkpoint: buildCheckpoint(session, sessionSteps(next, session.id)),
      });
      replaceSession(next, session);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "confirmation_requested",
        summary: pending.title,
        metadata: { token, expiresAt: pending.confirmationExpiresAt },
      });
      pushNotification(next, {
        userId: viewer.userId,
        sessionId: session.id,
        kind: "needs_confirmation",
        title: "Agente precisa de confirmação",
        message: pending.title,
        href: `/dashboard/agents/${session.id}`,
      });
      break;
    }

    // Execute
    if (
      alreadyExecuted(session.checkpoint, pending.idempotencyKey)
    ) {
      pending.status = "VERIFIED";
      pending.error = null;
      replaceStep(next, pending);
      pushAudit(next, {
        sessionId: session.id,
        userId: viewer.userId,
        workspaceId: viewer.workspaceId,
        action: "action_executed",
        summary: "idempotent_skip",
        metadata: { idempotencyKey: pending.idempotencyKey },
      });
      continue;
    }

    const exec = await invokeAgentTool({
      agentId: agent.id,
      actionId: pending.actionId,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      context: session.workspaceId ? "workspace" : "personal",
      input: pending.input,
      confirmed: Boolean(opts?.confirmed) || Boolean(autoSafe),
    });

    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "action_executed",
      summary: exec.ok ? "ok" : exec.error ?? "fail",
      metadata: { sanitizedInput: exec.sanitizedInput, outputKeys: Object.keys(exec.output) },
    });

    const verification = verifyStepResult({
      step: pending,
      output: exec.output,
      ok: exec.ok,
      error: exec.error,
      policy: agent.verificationPolicy,
    });

    pending.executionResult = exec.output;
    pending.verification = verification;
    pending.error = verification.ok ? null : verification.error;
    pending.status = verification.ok ? "VERIFIED" : "FAILED";
    replaceStep(next, { ...pending, updatedAt: nowIso() });

    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: verification.ok
        ? "verification_succeeded"
        : "verification_failed",
      summary: verification.observedChange,
      metadata: { evidence: verification.evidence },
    });

    session = {
      ...session,
      stepsUsed: session.stepsUsed + 1,
      actionsUsed: session.actionsUsed + (exec.ok ? 1 : 0),
      retriesUsed: verification.ok ? session.retriesUsed : session.retriesUsed + 1,
      currentStepId: pending.id,
      checkpoint: buildCheckpoint(
        session,
        sessionSteps(next, session.id).map((s) =>
          s.id === pending.id ? pending : s
        )
      ),
      updatedAt: nowIso(),
      rowVersion: session.rowVersion + 1,
    };
    replaceSession(next, session);

    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "checkpoint_saved",
      summary: `step ${session.checkpoint?.stepIndex}`,
      metadata: { completed: session.checkpoint?.completedSteps.length },
    });

    if (!verification.ok) {
      const kind = classifyRecovery(verification.error);
      if (kind === "retryable" && session.retriesUsed < agent.maximumRetries) {
        pending.status = "PENDING";
        replaceStep(next, pending);
        continue;
      }
      session = releaseSessionLease({
        ...session,
        status: statusAfterRecovery(kind),
        error: verification.error,
      });
      replaceSession(next, session);
      break;
    }
  }

  session = findSession(next, sessionId)!;
  if (session.leaseOwner) {
    session = releaseSessionLease(session);
    replaceSession(next, session);
    pushAudit(next, {
      sessionId: session.id,
      userId: viewer.userId,
      workspaceId: viewer.workspaceId,
      action: "lease_released",
      summary: "Lease liberado",
      metadata: {},
    });
  }

  // Absolute loop guard
  if (loops >= maxLoop && session.status === "RUNNING") {
    session = {
      ...session,
      status: "PARTIAL",
      report: "Parcial: limite de loop atingido",
      completedAt: nowIso(),
    };
    replaceSession(next, session);
  }

  return { ok: true, error: null, data: findSession(next, sessionId)!, state: next };
}

export function confirmAgentStepPure(
  state: AgentState,
  viewer: AgentViewer,
  sessionId: string,
  confirmationToken: string
): RuntimeResult<AgentSession> {
  const next = cloneAgentState(state);
  const session = findSession(next, sessionId);
  if (!session) return { ok: false, error: "not_found", data: null, state };

  const confCheck = canConfirmSession(viewer, session);
  if (!confCheck.ok) {
    return {
      ok: false,
      error: confCheck.failures[0] ?? "forbidden",
      data: null,
      state,
    };
  }

  const conf = next.confirmations.find(
    (c) =>
      c.sessionId === sessionId &&
      c.token === confirmationToken &&
      !c.revoked
  );
  if (!conf) {
    return { ok: false, error: "invalid_confirmation_token", data: null, state };
  }
  if (Date.parse(conf.expiresAt) < Date.now()) {
    return { ok: false, error: "confirmation_expired", data: null, state };
  }

  const step = next.steps.find((s) => s.id === conf.stepId);
  if (!step) return { ok: false, error: "step_not_found", data: null, state };

  const hash = hashPayload(step.input);
  if (hash !== conf.payloadHash) {
    return {
      ok: false,
      error: "confirmation_payload_mismatch",
      data: null,
      state,
    };
  }

  conf.confirmedAt = nowIso();
  conf.confirmedBy = viewer.userId;
  step.status = "PREPARED";
  step.requiresConfirmation = false;
  replaceStep(next, step);

  const updated: AgentSession = {
    ...session,
    status: "READY",
    updatedAt: nowIso(),
    rowVersion: session.rowVersion + 1,
  };
  replaceSession(next, updated);
  pushAudit(next, {
    sessionId,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "confirmation_received",
    summary: step.title,
    metadata: { actor: viewer.userId },
  });
  return { ok: true, error: null, data: updated, state: next };
}

export function answerAgentInputPure(
  state: AgentState,
  viewer: AgentViewer,
  sessionId: string,
  answer: string
): RuntimeResult<AgentSession> {
  const next = cloneAgentState(state);
  const session = findSession(next, sessionId);
  if (!session) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutateSession(viewer, session);
  if (!mut.ok) {
    return { ok: false, error: mut.failures[0] ?? "forbidden", data: null, state };
  }

  const step = sessionSteps(next, sessionId).find(
    (s) => s.status === "WAITING_INPUT"
  );
  if (!step) return { ok: false, error: "no_waiting_input", data: null, state };

  step.userAnswer = answer.slice(0, 1000);
  step.input = {
    ...step.input,
    title: answer.slice(0, 80),
    message: answer.slice(0, 400),
  };
  step.status = "PENDING";
  // Invalidate any prior confirmation
  step.confirmationToken = null;
  step.confirmationPayloadHash = null;
  replaceStep(next, step);

  const updated: AgentSession = {
    ...session,
    status: "READY",
    objective: session.objective,
    updatedAt: nowIso(),
    rowVersion: session.rowVersion + 1,
  };
  replaceSession(next, updated);
  pushAudit(next, {
    sessionId,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "input_received",
    summary: "Resposta do usuário",
    metadata: { len: answer.length },
  });
  return { ok: true, error: null, data: updated, state: next };
}

export function pauseAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  sessionId: string
): RuntimeResult<AgentSession> {
  const next = cloneAgentState(state);
  const session = findSession(next, sessionId);
  if (!session) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutateSession(viewer, session);
  if (!mut.ok) {
    return { ok: false, error: mut.failures[0] ?? "forbidden", data: null, state };
  }
  const updated = releaseSessionLease({
    ...session,
    status: "PAUSED",
    updatedAt: nowIso(),
  });
  replaceSession(next, updated);
  pushAudit(next, {
    sessionId,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "session_paused",
    summary: "Pausada",
    metadata: {},
  });
  pushNotification(next, {
    userId: viewer.userId,
    sessionId,
    kind: "paused",
    title: "Sessão pausada",
    message: session.objective,
    href: `/dashboard/agents/${sessionId}`,
  });
  return { ok: true, error: null, data: updated, state: next };
}

export function cancelAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  sessionId: string
): RuntimeResult<AgentSession> {
  const next = cloneAgentState(state);
  const session = findSession(next, sessionId);
  if (!session) return { ok: false, error: "not_found", data: null, state };
  const mut = canMutateSession(viewer, session);
  if (!mut.ok) {
    return { ok: false, error: mut.failures[0] ?? "forbidden", data: null, state };
  }
  const updated = releaseSessionLease({
    ...session,
    status: "CANCELLED",
    completedAt: nowIso(),
    updatedAt: nowIso(),
  });
  replaceSession(next, updated);
  for (const c of next.confirmations) {
    if (c.sessionId === sessionId && !c.confirmedAt) c.revoked = true;
  }
  pushAudit(next, {
    sessionId,
    userId: viewer.userId,
    workspaceId: viewer.workspaceId,
    action: "session_cancelled",
    summary: "Cancelada",
    metadata: {},
  });
  return { ok: true, error: null, data: updated, state: next };
}

export function listAgentSessionsPure(
  state: AgentState,
  viewer: AgentViewer,
  opts?: { status?: string | string[]; agentId?: string; limit?: number }
): AgentSession[] {
  let items = state.sessions.filter(
    (s) => !s.softDeleted && canViewSession(viewer, s)
  );
  if (opts?.agentId) items = items.filter((s) => s.agentId === opts.agentId);
  if (opts?.status) {
    const st = Array.isArray(opts.status) ? opts.status : [opts.status];
    items = items.filter((s) => st.includes(s.status));
  }
  return items.slice(0, opts?.limit ?? 100);
}

export function getAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  id: string
): AgentSession | null {
  const s = findSession(state, id);
  if (!s || !canViewSession(viewer, s)) return null;
  return s;
}

export function explainAgentSessionPure(
  state: AgentState,
  viewer: AgentViewer,
  id: string
): AgentExplanation | null {
  const s = getAgentSessionPure(state, viewer, id);
  if (!s) return null;
  const step = sessionSteps(state, id).find((x) => x.id === s.currentStepId);
  return {
    sessionId: s.id,
    agentId: s.agentId,
    why: `Agente controlado para: ${s.objective}`,
    objective: s.objective,
    planId: s.planId,
    currentAction: step?.actionId ?? null,
    willChange: step
      ? [`Artefato via ${step.actionId}`]
      : ["Nenhuma alteração pendente"],
    willNotChange: [
      "Pagamentos",
      "E-mail / WhatsApp / publish",
      "Exclusões",
      "Permissões",
      "Shell / SQL / código arbitrário",
      "Dados de outros usuários",
    ],
    riskCeiling: s.riskCeiling,
    autonomyLevel: s.autonomyLevel,
    budgets: formatBudgetReport(s),
    limitations: [
      "Somente Action Registry",
      "Somente allowlist do agente",
      "Human-in-the-loop quando necessário",
      "Sem loop infinito",
    ],
  };
}

export function getHomeAgentWidgetPure(
  state: AgentState,
  viewer: AgentViewer,
  now = new Date()
): AgentHomeWidget {
  const items = listAgentSessionsPure(state, viewer, { limit: 200 });
  const day = now.toISOString().slice(0, 10);
  return {
    active: items
      .filter((s) => ["RUNNING", "READY", "PAUSED"].includes(s.status))
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        agentId: s.agentId,
        objective: s.objective,
      })),
    awaitingConfirmation: items
      .filter((s) => s.status === "WAITING_CONFIRMATION")
      .slice(0, 8)
      .map((s) => ({ id: s.id, objective: s.objective })),
    awaitingInput: items
      .filter((s) => s.status === "WAITING_INPUT")
      .slice(0, 8)
      .map((s) => {
        const step = sessionSteps(state, s.id).find(
          (x) => x.status === "WAITING_INPUT"
        );
        return {
          id: s.id,
          objective: s.objective,
          question: step?.question ?? null,
        };
      }),
    completedToday: items
      .filter(
        (s) =>
          s.status === "COMPLETED" &&
          s.completedAt &&
          s.completedAt.startsWith(day)
      )
      .slice(0, 8)
      .map((s) => ({ id: s.id, objective: s.objective })),
    failed: items
      .filter((s) => s.status === "FAILED" || s.status === "BLOCKED")
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        objective: s.objective,
        error: s.error,
      })),
    upcomingReviews: items
      .filter((s) => s.status === "READY" || s.status === "PAUSED")
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        objective: s.objective,
        expiresAt: s.expiresAt,
      })),
  };
}

function buildReport(
  session: AgentSession,
  steps: AgentStep[],
  agentName: string
): string {
  const ok = steps.filter((s) => s.status === "VERIFIED").length;
  const fail = steps.filter((s) => s.status === "FAILED").length;
  return [
    `Relatório — ${agentName}`,
    `Objetivo: ${session.objective}`,
    `Passos verificados: ${ok}`,
    `Falhas: ${fail}`,
    `Ações: ${session.actionsUsed}/${session.actionBudget}`,
    session.planId ? `Plano: ${session.planId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export { canViewSession, canMutateSession, sessionSteps as listSessionStepsPure };
