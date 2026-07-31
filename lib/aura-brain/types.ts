/**
 * Aura Brain Core — shared types.
 * Structured outputs only — never free-form chat as primary result.
 */

export type AutonomyLevel = "SUGGEST" | "PREPARE" | "CONFIRM" | "AUTO_SAFE";

export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AuraBrainContextMode = "personal" | "workspace";

export type PlanStatus =
  | "DRAFT"
  | "PROPOSED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type ActionExecutionStatus =
  | "proposed"
  | "prepared"
  | "awaiting_confirmation"
  | "executed"
  | "failed"
  | "cancelled"
  | "undone"
  | "rejected";

export type AuraBrainSettings = {
  userId: string;
  defaultAutonomyLevel: AutonomyLevel;
  allowedActionTypes: string[];
  blockedActionTypes: string[];
  quietHours: { startHour: number; endHour: number } | null;
  dailyExecutionLimit: number;
  requireConfirmationForFinancialActions: boolean;
  requireConfirmationForExternalCommunication: boolean;
  requireConfirmationForDeletion: boolean;
  automationsEnabled: boolean;
  /** Sprint 8.1 — allow AUTO_SAFE execution for LOW eligible actions */
  allowAutoSafe: boolean;
  /** Sprint 8.1 — pause all automations (kill switch) */
  pauseAllAutomations: boolean;
  updatedAt: string;
};

export const DEFAULT_AURA_BRAIN_SETTINGS: Omit<
  AuraBrainSettings,
  "userId" | "updatedAt"
> = {
  defaultAutonomyLevel: "SUGGEST",
  allowedActionTypes: [],
  blockedActionTypes: [],
  quietHours: null,
  dailyExecutionLimit: 20,
  requireConfirmationForFinancialActions: true,
  requireConfirmationForExternalCommunication: true,
  requireConfirmationForDeletion: true,
  automationsEnabled: true,
  allowAutoSafe: false,
  pauseAllAutomations: false,
};

export type AuraBrainPlanStep = {
  id: string;
  order: number;
  actionId: string;
  title: string;
  status: PlanStatus;
  input: Record<string, unknown>;
};

export type AuraBrainPlan = {
  id: string;
  title: string;
  objective: string;
  source: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: PlanStatus;
  context: AuraBrainContextMode;
  steps: AuraBrainPlanStep[];
  createdAt: string;
  expiresAt: string | null;
  confidence: number;
  requiresConfirmation: boolean;
};

export type ProposedAction = {
  id: string;
  actionId: string;
  planId: string | null;
  title: string;
  reason: string;
  riskLevel: ActionRiskLevel;
  autonomyRequired: AutonomyLevel;
  input: Record<string, unknown>;
  status: ActionExecutionStatus;
  dedupeKey: string;
};

export type ExecutableAction = ProposedAction & {
  canExecute: boolean;
  blockReason: string | null;
};

export type AuraBrainAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  context: AuraBrainContextMode;
  source: string;
  planId: string | null;
  actionId: string | null;
  automationId: string | null;
  autonomyLevel: AutonomyLevel;
  riskLevel: ActionRiskLevel | null;
  inputSummary: Record<string, unknown>;
  status: ActionExecutionStatus | "analyzed" | "skipped";
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  undoAvailable: boolean;
};

export type AutomationResult = {
  automationId: string;
  status: "executed" | "skipped" | "failed";
  reason: string;
  actionId: string | null;
  auditId: string | null;
};

export type AuraBrainRunResult = {
  context: {
    userId: string;
    workspaceId: string | null;
    mode: AuraBrainContextMode;
    autonomy: AutonomyLevel;
    settings: AuraBrainSettings;
  };
  intelligence: {
    priorities: unknown[];
    alerts: unknown[];
    recommendations: unknown[];
    insights: unknown[];
    score: unknown;
    meta: { executionMs: number; cacheHit: boolean };
  };
  /** Identity Engine slice — optional, never drives Execution in Sprint 6.2 */
  identity: {
    communicationTone: string | null;
    preferenceLabels: string[];
    confirmedKeys: string[];
    constraintLabels: string[];
    conflictCount: number;
    executionInfluence: "none";
  } | null;
  /** Memory Engine slice — optional, never drives Execution in Sprint 6.3 */
  memory: {
    titles: string[];
    factCount: number;
    hypothesisCount: number;
    executionInfluence: "none";
  } | null;
  /** World Model slice — optional, never drives Execution in Sprint 6.4 */
  world: {
    entityNames: string[];
    relationshipSummaries: string[];
    entityCount: number;
    relationshipCount: number;
    executionInfluence: "none";
  } | null;
  /** Cognitive Engine slice — optional, never drives Execution in Sprint 6.5 */
  cognitive: {
    insightTitles: string[];
    patternCount: number;
    conflictCount: number;
    recommendationCount: number;
    executionInfluence: "none";
  } | null;
  /** Discovery Engine slice — optional, never drives Execution in RC2 */
  discovery: {
    opportunityTitles: string[];
    riskTitles: string[];
    pendingCount: number;
    recentCount: number;
    executionInfluence: "none";
  } | null;
  plans: AuraBrainPlan[];
  proposedActions: ProposedAction[];
  executableActions: ExecutableAction[];
  automationResults: AutomationResult[];
  auditEntries: AuraBrainAuditEntry[];
  meta: {
    generatedAt: string;
    plannerMs: number;
    automationMs: number;
    totalMs: number;
  };
};

/* ---------- Business Lab foundation (types only) ---------- */

export type BusinessOpportunity = {
  id: string;
  title: string;
  problem: string;
  audience: string;
  status: "draft" | "exploring" | "validated" | "archived";
};

export type BusinessHypothesis = {
  id: string;
  opportunityId: string;
  statement: string;
  evidence: string[];
};

export type RevenueModel = {
  id: string;
  opportunityId: string;
  model: string;
  pricePoint: number | null;
  notes: string;
};

export type BusinessExperiment = {
  id: string;
  opportunityId: string;
  hypothesisId: string;
  method: string;
  status: "planned" | "running" | "done" | "cancelled";
};

export type BusinessMission = {
  id: string;
  opportunityId: string;
  title: string;
  steps: string[];
  status: "draft" | "active" | "done";
};
