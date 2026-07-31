/**
 * Policy engine — fail closed before every step.
 */

import { getAction, isBlockedActionId } from "@/lib/aura-brain/actions/registry";
import { isInQuietHours } from "@/lib/aura-brain/autonomy";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import {
  AUTONOMY_RANK,
  RISK_RANK,
  type AgentDefinition,
  type AgentRuntimeSettings,
  type AgentSession,
  type AgentViewer,
  type AgentStep,
} from "@/lib/agent-runtime/types";
import { isActionAllowedForAgent } from "@/lib/agent-runtime/registry";

export type PolicyResult = { ok: boolean; failures: string[] };

export function canViewSession(
  viewer: AgentViewer,
  session: AgentSession
): boolean {
  if (viewer.userId === session.ownerId || viewer.userId === session.userId)
    return true;
  if (session.workspaceId && viewer.isWorkspaceMember) return true;
  return false;
}

export function canMutateSession(
  viewer: AgentViewer,
  session: AgentSession
): PolicyResult {
  const failures: string[] = [];
  if (viewer.userId !== session.ownerId && viewer.userId !== session.userId) {
    if (!session.workspaceId || !viewer.isWorkspaceMember) {
      failures.push("ownership_required");
    } else {
      const role = (viewer.role ?? "viewer").toLowerCase();
      if (role === "viewer") failures.push("viewer_cannot_mutate");
    }
  }
  if (
    session.workspaceId &&
    viewer.workspaceId &&
    session.workspaceId !== viewer.workspaceId
  ) {
    failures.push("workspace_mismatch");
  }
  return { ok: failures.length === 0, failures };
}

export function canConfirmSession(
  viewer: AgentViewer,
  session: AgentSession
): PolicyResult {
  const mut = canMutateSession(viewer, session);
  if (!mut.ok) return mut;
  const role = (viewer.role ?? "owner").toLowerCase();
  if (role === "viewer") {
    return { ok: false, failures: ["viewer_cannot_confirm"] };
  }
  return { ok: true, failures: [] };
}

export function evaluateStepPolicy(params: {
  agent: AgentDefinition;
  session: AgentSession;
  step: AgentStep;
  viewer: AgentViewer;
  brainSettings: AuraBrainSettings;
  runtimeSettings: AgentRuntimeSettings;
  planStatus?: string | null;
  planRowVersion?: number | null;
  expectedPlanVersion?: string | null;
  now?: Date;
}): PolicyResult {
  const failures: string[] = [];
  const {
    agent,
    session,
    step,
    viewer,
    brainSettings,
    runtimeSettings,
  } = params;
  const now = params.now ?? new Date();

  if (runtimeSettings.pauseAllAgents) failures.push("agents_paused");
  const agentSettings = runtimeSettings.perAgent[agent.id];
  if (agentSettings && agentSettings.enabled === false) {
    failures.push("agent_disabled");
  }

  if (Date.parse(session.expiresAt) < now.getTime()) {
    failures.push("session_expired");
  }

  const mut = canMutateSession(viewer, session);
  if (!mut.ok) failures.push(...mut.failures);

  if (
    agent.requiresApprovedPlan &&
    params.planStatus &&
    !["APPROVED", "IN_PROGRESS"].includes(params.planStatus.toUpperCase())
  ) {
    failures.push("plan_not_approved");
  }

  if (
    params.expectedPlanVersion &&
    params.planRowVersion != null &&
    String(params.planRowVersion) !== params.expectedPlanVersion
  ) {
    failures.push("plan_changed");
  }

  if (!step.actionId) {
    failures.push("no_action_selected");
  } else {
    if (isBlockedActionId(step.actionId)) failures.push("blocked_action");
    if (!isActionAllowedForAgent(agent, step.actionId)) {
      failures.push("action_not_allowed_for_agent");
    }
    const def = getAction(step.actionId);
    if (!def) failures.push("action_not_registered");
    else {
      if (RISK_RANK[def.riskLevel] > RISK_RANK[agent.maximumRiskLevel]) {
        failures.push("risk_above_agent_ceiling");
      }
      if (RISK_RANK[def.riskLevel] > RISK_RANK[session.riskCeiling]) {
        failures.push("risk_above_session_ceiling");
      }
      if (def.isExternalComm) failures.push("external_communication_forbidden");
      if (def.isDeletion) failures.push("deletion_forbidden");
      if (def.isPermissionChange) failures.push("permission_change_forbidden");
      if (def.isFinancialFinal) failures.push("financial_final_forbidden");
      if (
        !agent.allowedContexts.includes(session.workspaceId ? "workspace" : "personal")
      ) {
        failures.push("context_not_allowed");
      }
    }
  }

  if (
    !agent.supportedAutonomyLevels.includes(session.autonomyLevel)
  ) {
    failures.push("autonomy_not_supported");
  }

  const maxAuto =
    agentSettings?.maxAutonomyLevel ?? brainSettings.defaultAutonomyLevel;
  if (AUTONOMY_RANK[session.autonomyLevel] > AUTONOMY_RANK[maxAuto]) {
    failures.push("autonomy_above_settings");
  }

  if (session.autonomyLevel === "AUTO_SAFE" && !runtimeSettings.allowAutoSafe) {
    failures.push("auto_safe_disabled");
  }

  if (isInQuietHours(agentSettings?.quietHours ?? brainSettings.quietHours, now)) {
    failures.push("quiet_hours_blocked");
  }

  if (session.stepsUsed >= session.stepBudget) failures.push("step_budget_exceeded");
  if (session.actionsUsed >= session.actionBudget)
    failures.push("action_budget_exceeded");
  if (
    session.startedAt &&
    Date.now() - Date.parse(session.startedAt) > session.timeBudgetMs
  ) {
    failures.push("time_budget_exceeded");
  }

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}
