/**
 * Sprint 8.2 — Aura Agent Runtime V1 contracts.
 * Controlled operational agents. No unrestricted autonomy.
 * Tools = Action Registry wrappers only. No shell/SQL/arbitrary code.
 */

import type {
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainContextMode,
} from "@/lib/aura-brain/types";

export type AgentId =
  | "daily_organizer_v1"
  | "plan_assistant_v1"
  | "project_review_v1"
  | "knowledge_organizer_v1"
  | "business_preparation_v1";

export type AgentSessionStatus =
  | "DRAFT"
  | "READY"
  | "RUNNING"
  | "WAITING_CONFIRMATION"
  | "WAITING_INPUT"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "BLOCKED";

export type AgentSourceType =
  | "plan"
  | "manual"
  | "daily_review"
  | "project"
  | "knowledge"
  | "business";

export type AgentMemoryPolicy = "confirmed_only" | "eligible_read" | "none";
export type AgentVerificationPolicy = "strict" | "basic";

export type AgentDefinition = {
  id: AgentId;
  version: string;
  name: string;
  description: string;
  purpose: string;
  allowedContexts: AuraBrainContextMode[];
  allowedActionIds: string[];
  blockedActionIds: string[];
  maximumRiskLevel: ActionRiskLevel;
  supportedAutonomyLevels: AutonomyLevel[];
  requiredRoles: Array<"any" | "member" | "editor" | "admin" | "owner">;
  maximumSteps: number;
  maximumDurationMs: number;
  maximumActions: number;
  maximumRetries: number;
  requiresApprovedPlan: boolean;
  contextBudget: number;
  memoryPolicy: AgentMemoryPolicy;
  verificationPolicy: AgentVerificationPolicy;
  stopConditions: string[];
  enabledByDefault: boolean;
};

export type AgentTool = {
  actionId: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskLevel: ActionRiskLevel;
  timeoutMs: number;
  idempotencyRequired: boolean;
  requiresConfirmation: boolean;
  sanitizeForAudit: (input: Record<string, unknown>) => Record<string, unknown>;
};

export type AgentCheckpoint = {
  stepIndex: number;
  completedSteps: string[];
  pendingSteps: string[];
  executedActionIds: string[];
  executedIdempotencyKeys: string[];
  generatedArtifactIds: string[];
  pendingConfirmationId: string | null;
  contextVersion: string;
  planVersion: string | null;
  lastResult: Record<string, unknown> | null;
  timestamp: string;
};

export type AgentStep = {
  id: string;
  sessionId: string;
  index: number;
  title: string;
  planStepId: string | null;
  actionId: string | null;
  status:
    | "PENDING"
    | "PREPARED"
    | "WAITING_CONFIRMATION"
    | "WAITING_INPUT"
    | "EXECUTED"
    | "VERIFIED"
    | "FAILED"
    | "SKIPPED"
    | "BLOCKED";
  input: Record<string, unknown>;
  preparedOutput: Record<string, unknown> | null;
  executionResult: Record<string, unknown> | null;
  verification: AgentVerificationResult | null;
  error: string | null;
  idempotencyKey: string;
  requiresConfirmation: boolean;
  confirmationToken: string | null;
  confirmationExpiresAt: string | null;
  confirmationPayloadHash: string | null;
  question: string | null;
  userAnswer: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentVerificationResult = {
  ok: boolean;
  expectedChange: string;
  observedChange: string;
  partial: boolean;
  inconsistent: boolean;
  evidence: string[];
  error: string | null;
};

export type AgentConfirmation = {
  id: string;
  sessionId: string;
  stepId: string;
  token: string;
  payloadHash: string;
  requestedBy: string;
  confirmedBy: string | null;
  expiresAt: string;
  confirmedAt: string | null;
  revoked: boolean;
  createdAt: string;
};

export type AgentAuditAction =
  | "session_created"
  | "session_started"
  | "context_built"
  | "step_selected"
  | "action_proposed"
  | "action_prepared"
  | "confirmation_requested"
  | "confirmation_received"
  | "input_requested"
  | "input_received"
  | "action_executed"
  | "verification_succeeded"
  | "verification_failed"
  | "checkpoint_saved"
  | "session_paused"
  | "session_resumed"
  | "session_completed"
  | "session_partial"
  | "session_failed"
  | "session_cancelled"
  | "budget_exceeded"
  | "policy_blocked"
  | "lease_acquired"
  | "lease_released"
  | "provider_invoked"
  | "provider_failed";

export type AgentAuditEntry = {
  id: string;
  sessionId: string | null;
  userId: string;
  workspaceId: string | null;
  action: AgentAuditAction;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AgentNotification = {
  id: string;
  userId: string;
  sessionId: string;
  kind:
    | "needs_confirmation"
    | "needs_input"
    | "completed"
    | "partial"
    | "failed"
    | "paused"
    | "budget_exceeded"
    | "context_changed";
  title: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export type AgentContextSlice = {
  identityHints: Array<{ id: string; title: string; confirmed: boolean }>;
  memories: Array<{ id: string; title: string; summary: string }>;
  worldEntities: Array<{ id: string; name: string }>;
  cognitive: Array<{ id: string; title: string }>;
  discoveries: Array<{ id: string; title: string; confirmed: boolean }>;
  decisions: Array<{ id: string; title: string }>;
  scenarios: Array<{ id: string; title: string }>;
  priorities: Array<{ id: string; title: string }>;
  recommendations: Array<{ id: string; title: string; status?: string }>;
  plans: Array<{
    id: string;
    title: string;
    status: string;
    steps: Array<{
      id: string;
      title: string;
      status: string;
      stepType?: string;
      description?: string;
    }>;
    rowVersion?: number;
  }>;
  projects: Array<{ id: string; name: string; status: string }>;
  knowledge: Array<{ id: string; title: string }>;
  generatedAt: string;
  version: string;
  readOnly: true;
};

export type AgentSession = {
  id: string;
  agentId: AgentId;
  agentVersion: string;
  userId: string;
  workspaceId: string | null;
  ownerId: string;
  objective: string;
  sourceType: AgentSourceType;
  sourceId: string | null;
  planId: string | null;
  projectId: string | null;
  status: AgentSessionStatus;
  autonomyLevel: AutonomyLevel;
  riskCeiling: ActionRiskLevel;
  stepBudget: number;
  actionBudget: number;
  timeBudgetMs: number;
  stepsUsed: number;
  actionsUsed: number;
  retriesUsed: number;
  contextSnapshot: AgentContextSlice | null;
  currentStepId: string | null;
  checkpoint: AgentCheckpoint | null;
  result: Record<string, unknown> | null;
  report: string | null;
  error: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  rowVersion: number;
  softDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgentSettings = {
  agentId: AgentId;
  enabled: boolean;
  maxAutonomyLevel: AutonomyLevel;
  allowedActionIds: string[];
  allowedProjectIds: string[];
  allowedWorkspaceIds: string[];
  stepLimit: number;
  actionLimit: number;
  dailyLimit: number;
  quietHours: { startHour: number; endHour: number } | null;
  requireConfirmation: boolean;
};

export type AgentRuntimeSettings = {
  pauseAllAgents: boolean;
  allowAutoSafe: boolean;
  perAgent: Partial<Record<AgentId, AgentSettings>>;
};

export type AgentState = {
  sessions: AgentSession[];
  steps: AgentStep[];
  confirmations: AgentConfirmation[];
  audits: AgentAuditEntry[];
  notifications: AgentNotification[];
  settings: AgentRuntimeSettings;
  dailyCounts: Record<string, number>;
};

export function createEmptyAgentState(): AgentState {
  return {
    sessions: [],
    steps: [],
    confirmations: [],
    audits: [],
    notifications: [],
    settings: {
      pauseAllAgents: false,
      allowAutoSafe: false,
      perAgent: {},
    },
    dailyCounts: {},
  };
}

export type AgentViewer = {
  userId: string;
  workspaceId: string | null;
  role?: string | null;
  isWorkspaceMember?: boolean;
};

export type RunAgentSessionInput = {
  agentId: AgentId;
  objective: string;
  sourceType: AgentSourceType;
  sourceId?: string | null;
  planId?: string | null;
  planStatus?: string | null;
  planRowVersion?: number | null;
  projectId?: string | null;
  autonomyLevel?: AutonomyLevel;
  context?: Partial<AgentContextSlice>;
};

export type AgentHomeWidget = {
  active: Array<{ id: string; agentId: AgentId; objective: string }>;
  awaitingConfirmation: Array<{ id: string; objective: string }>;
  awaitingInput: Array<{ id: string; objective: string; question: string | null }>;
  completedToday: Array<{ id: string; objective: string }>;
  failed: Array<{ id: string; objective: string; error: string | null }>;
  upcomingReviews: Array<{ id: string; objective: string; expiresAt: string }>;
};

export type AgentExplanation = {
  sessionId: string;
  agentId: AgentId;
  why: string;
  objective: string;
  planId: string | null;
  currentAction: string | null;
  willChange: string[];
  willNotChange: string[];
  riskCeiling: ActionRiskLevel;
  autonomyLevel: AutonomyLevel;
  budgets: { steps: string; actions: string; time: string };
  limitations: string[];
};

export const AGENT_STATUS_LABELS: Record<AgentSessionStatus, string> = {
  DRAFT: "Rascunho",
  READY: "Pronta",
  RUNNING: "Em execução",
  WAITING_CONFIRMATION: "Aguardando confirmação",
  WAITING_INPUT: "Aguardando informação",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  PARTIAL: "Parcial",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
  BLOCKED: "Bloqueada",
};

export const CONFIRMATION_TTL_MS = 15 * 60 * 1000;
export const LEASE_TTL_MS = 30_000;
export const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

export const RISK_RANK: Record<ActionRiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const AUTONOMY_RANK: Record<AutonomyLevel, number> = {
  SUGGEST: 0,
  PREPARE: 1,
  CONFIRM: 2,
  AUTO_SAFE: 3,
};

export const FORBIDDEN_CAPABILITIES = [
  "shell",
  "sql",
  "arbitrary_code",
  "filesystem",
  "process.env",
  "service_role",
  "unrestricted_fetch",
  "payment",
  "external_email",
  "external_message",
  "publish",
  "delete_auto",
  "permission_change",
] as const;
