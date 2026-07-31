/**
 * Sprint 8.1 — Automation Engine V1 contracts.
 * Controlled, auditable, user-authorized automations from approved plan steps.
 * No autonomous agents. No unrestricted autonomy. No high-risk / external / payment / delete.
 *
 * Upstream layers (Identity…Plan) keep executionInfluence: "none".
 * Only automation artifacts may use proposed|prepared|confirmed|auto_safe|executed.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainContextMode,
} from "@/lib/aura-brain/types";
import type { ActionReversibility } from "@/lib/aura-brain/actions/types";

export const AUTOMATION_EXECUTION_INFLUENCES = [
  "proposed",
  "prepared",
  "confirmed",
  "auto_safe",
  "executed",
] as const;

export type AutomationExecutionInfluence =
  (typeof AUTOMATION_EXECUTION_INFLUENCES)[number];

export type AutomationStatus =
  | "DRAFT"
  | "PROPOSED"
  | "PREPARED"
  | "AWAITING_CONFIRMATION"
  | "APPROVED"
  | "SCHEDULED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "UNDONE"
  | "BLOCKED";

export type AutomationTriggerType =
  | "PLAN_STEP"
  | "MANUAL"
  | "SAFE_DATA"
  | "CRITICAL_PRIORITY"
  | "ACCEPTED_RECOMMENDATION"
  | "DAILY_REVIEW_MANUAL";

export type AutomationSourceType =
  | "plan_step"
  | "manual"
  | "safe_data"
  | "critical_priority"
  | "accepted_recommendation"
  | "daily_review";

export type AutomationErrorClass =
  | "RETRYABLE"
  | "NON_RETRYABLE"
  | "AUTH_REQUIRED"
  | "VALIDATION"
  | "PERMISSION"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "CONFLICT"
  | "DEPENDENCY_BLOCKED";

export type AutomationAuditAction =
  | "automation_created"
  | "automation_prepared"
  | "automation_confirmation_requested"
  | "automation_confirmed"
  | "automation_scheduled"
  | "automation_started"
  | "automation_succeeded"
  | "automation_failed"
  | "automation_blocked"
  | "automation_cancelled"
  | "automation_expired"
  | "automation_retry_scheduled"
  | "automation_undone"
  | "automation_undo_failed"
  | "lease_acquired"
  | "lease_released"
  | "limit_reached"
  | "cooldown_active"
  | "quiet_hours_blocked";

export type Automation = {
  id: string;
  title: string;
  description: string;
  status: AutomationStatus;
  triggerType: AutomationTriggerType;
  sourceType: AutomationSourceType;
  sourceId: string | null;
  planId: string | null;
  planStepId: string | null;
  actionId: string;
  actionVersion: string;
  workspaceId: string | null;
  ownerId: string;
  createdBy: string;
  autonomyLevel: AutonomyLevel;
  riskLevel: ActionRiskLevel;
  reversibility: ActionReversibility;
  input: Record<string, unknown>;
  preparedOutput: Record<string, unknown> | null;
  executionResult: Record<string, unknown> | null;
  executionError: string | null;
  errorClass: AutomationErrorClass | null;
  idempotencyKey: string;
  cooldownKey: string;
  scheduledFor: string | null;
  expiresAt: string | null;
  requiresConfirmation: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  confirmationToken: string | null;
  confirmationExpiresAt: string | null;
  confirmationPayloadHash: string | null;
  executedAt: string | null;
  undoneAt: string | null;
  undoToken: string | null;
  rowVersion: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  executionAttempt: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  context: AuraBrainContextMode;
  projectId: string | null;
  gateFailures: string[];
  explainSummary: string;
  evidence: string[];
  limitations: string[];
  willChange: string[];
  willNotChange: string[];
  executionInfluence: AutomationExecutionInfluence;
  softDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AutomationAttempt = {
  id: string;
  automationId: string;
  attempt: number;
  status: "STARTED" | "SUCCEEDED" | "FAILED" | "BLOCKED";
  errorClass: AutomationErrorClass | null;
  error: string | null;
  leaseOwner: string | null;
  startedAt: string;
  finishedAt: string | null;
  outputSummary: Record<string, unknown>;
};

export type AutomationConfirmation = {
  id: string;
  automationId: string;
  token: string;
  payloadHash: string;
  requestedBy: string;
  confirmedBy: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  revoked: boolean;
  createdAt: string;
};

export type AutomationAuditEntry = {
  id: string;
  automationId: string | null;
  userId: string;
  workspaceId: string | null;
  action: AutomationAuditAction;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AutomationNotification = {
  id: string;
  userId: string;
  automationId: string;
  kind:
    | "prepared"
    | "awaiting_confirmation"
    | "executed"
    | "failed"
    | "blocked"
    | "scheduled"
    | "undone"
    | "confirmation_expiring";
  title: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type AutomationState = {
  automations: Automation[];
  attempts: AutomationAttempt[];
  confirmations: AutomationConfirmation[];
  audits: AutomationAuditEntry[];
  notifications: AutomationNotification[];
  /** idempotencyKey → automationId */
  idempotencyIndex: Record<string, string>;
  /** cooldownKey → lastExecutedAt ISO */
  cooldownIndex: Record<string, string>;
  /** dayKey → count of SUCCEEDED executions */
  dailyCounts: Record<string, number>;
};

export function createEmptyAutomationState(): AutomationState {
  return {
    automations: [],
    attempts: [],
    confirmations: [],
    audits: [],
    notifications: [],
    idempotencyIndex: {},
    cooldownIndex: {},
    dailyCounts: {},
  };
}

export type AutomationListFilters = {
  status?: AutomationStatus | AutomationStatus[];
  actionId?: string;
  riskLevel?: ActionRiskLevel | ActionRiskLevel[];
  autonomyLevel?: AutonomyLevel | AutonomyLevel[];
  projectId?: string;
  planId?: string;
  ownerId?: string;
  workspaceId?: string | null;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type AutomationHomeWidget = {
  awaitingConfirmation: Array<{ id: string; title: string; riskLevel: string }>;
  scheduledToday: Array<{ id: string; title: string; scheduledFor: string }>;
  executedToday: Array<{ id: string; title: string; executedAt: string }>;
  failed: Array<{ id: string; title: string; error: string | null }>;
  blocked: Array<{ id: string; title: string; reason: string }>;
};

export type AutomationExplanation = {
  automationId: string;
  title: string;
  why: string;
  source: { type: string; id: string | null };
  planId: string | null;
  planStepId: string | null;
  recommendationId: string | null;
  evidence: string[];
  actionId: string;
  gates: string[];
  gateFailures: string[];
  riskLevel: ActionRiskLevel;
  autonomyLevel: AutonomyLevel;
  limitations: string[];
  willChange: string[];
  willNotChange: string[];
  executionInfluence: AutomationExecutionInfluence;
};

export type ProposeAutomationInput = {
  triggerType: AutomationTriggerType;
  sourceType: AutomationSourceType;
  sourceId?: string | null;
  planId?: string | null;
  planStepId?: string | null;
  actionId?: string;
  title?: string;
  description?: string;
  input?: Record<string, unknown>;
  projectId?: string | null;
  scheduledFor?: string | null;
  /** Plan must be APPROVED or IN_PROGRESS when from plan_step */
  planStatus?: string | null;
  planStepStatus?: string | null;
  recommendationStatus?: string | null;
  hypothesisConfirmed?: boolean;
};

export type AutomationViewer = {
  userId: string;
  workspaceId: string | null;
  role?: string | null;
  isWorkspaceMember?: boolean;
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationStatus, string> = {
  DRAFT: "Rascunho",
  PROPOSED: "Sugerida",
  PREPARED: "Preparada",
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  RUNNING: "Em execução",
  SUCCEEDED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  UNDONE: "Desfeita",
  BLOCKED: "Bloqueada",
};

export const BLOCKED_ACTION_IDS = [
  "send_email",
  "send_whatsapp",
  "publish_content",
  "make_payment",
  "buy_service",
  "delete_record",
  "change_permissions",
  "remove_member",
  "delete_workspace",
  "execute_arbitrary_code",
  "access_shell",
  "autonomous_external_research",
] as const;

/** Actions eligible for AUTO_SAFE when LOW + settings allow */
export const AUTO_SAFE_ELIGIBLE_ACTIONS = [
  "create_internal_notification",
  "create_notification",
  "create_personal_task_draft",
  "create_calendar_event_draft",
  "create_financial_entry_draft",
  "create_content_idea_draft",
  "create_business_idea_draft",
  "complete_habit",
  "update_goal_progress",
  "retry_expert_brain_document",
  "mark_plan_step_complete",
  "create_plan_review_reminder",
  "assign_internal_plan_owner",
  "archive_internal_notification",
  "create_mission_reminder",
  "create_mission_task_draft",
  "create_workout_plan_draft",
] as const;

export const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
export const LEASE_TTL_MS = 30_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_COOLDOWN_MS = 60_000;
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;
