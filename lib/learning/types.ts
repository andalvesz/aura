/**
 * Sprint 9.2 — Continuous Learning Engine contracts.
 * AUTO_OBSERVE only. Proposals require human review. No silent application.
 * Does not fine-tune, train models, or mutate Identity/Memory/Planner directly.
 */

import type { ActionRiskLevel } from "@/lib/aura-brain/types";

export type LearningSignalType =
  | "CONFIRMED"
  | "REJECTED"
  | "CORRECTED"
  | "ACCEPTED"
  | "IGNORED"
  | "USEFUL"
  | "NOT_USEFUL"
  | "COMPLETED"
  | "FAILED"
  | "UNDONE"
  | "RETRIED"
  | "PAUSED"
  | "ABANDONED"
  | "DEADLINE_CHANGED"
  | "OWNER_CHANGED"
  | "PLAN_SUCCEEDED"
  | "PLAN_FAILED"
  | "AUTOMATION_SUCCEEDED"
  | "AUTOMATION_FAILED"
  | "AGENT_COMPLETED"
  | "AGENT_PARTIAL"
  | "AGENT_BLOCKED"
  | "CONVERSATION_RATED"
  | "RECOMMENDATION_ACCEPTED"
  | "RECOMMENDATION_REJECTED"
  | "DISCOVERY_CONFIRMED"
  | "DISCOVERY_REJECTED"
  | "MEMORY_CORRECTED"
  | "IDENTITY_CORRECTED";

export type LearningSourceLayer =
  | "identity"
  | "memory"
  | "world"
  | "cognitive"
  | "discovery"
  | "decision"
  | "scenario"
  | "prioritization"
  | "recommendation"
  | "planner"
  | "automation"
  | "agent-runtime"
  | "conversation"
  | "projects"
  | "knowledge"
  | "daily"
  | "aura-brain";

export type LearningProposalType =
  | "PREFERENCE_UPDATE"
  | "COMMUNICATION_STYLE_UPDATE"
  | "PLANNING_RULE_UPDATE"
  | "DEADLINE_ESTIMATE_UPDATE"
  | "PRIORITY_WEIGHT_SUGGESTION"
  | "RECOMMENDATION_FILTER"
  | "SUPPRESSION_SUGGESTION"
  | "AUTOMATION_LIMIT_SUGGESTION"
  | "AGENT_POLICY_SUGGESTION"
  | "MEMORY_RETENTION_SUGGESTION"
  | "CONTEXT_RULE_SUGGESTION"
  | "DATA_COLLECTION_SUGGESTION";

export type LearningProposalStatus =
  | "DRAFT"
  | "GENERATED"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "REJECTED"
  | "APPLIED"
  | "EVALUATING"
  | "SUCCESSFUL"
  | "UNSUCCESSFUL"
  | "REVERTED"
  | "OUTDATED"
  | "ARCHIVED";

export type LearningScope =
  | "PERSONAL"
  | "WORKSPACE"
  | "PROJECT"
  | "MISSION"
  | "AGENT"
  | "AUTOMATION_ACTION"
  | "CONVERSATION_STYLE";

export type LearningSignal = {
  id: string;
  userId: string;
  workspaceId: string | null;
  signalType: LearningSignalType;
  sourceLayer: LearningSourceLayer;
  sourceType: string;
  sourceId: string;
  subjectType: string;
  subjectId: string;
  actorId: string;
  context: Record<string, string | number | boolean | null>;
  value: number;
  weight: number;
  confidence: number;
  occurredAt: string;
  idempotencyKey: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  softDeleted: boolean;
};

export type LearningPattern = {
  id: string;
  userId: string;
  workspaceId: string | null;
  patternKey: string;
  title: string;
  summary: string;
  scope: LearningScope;
  signalIds: string[];
  counterSignalIds: string[];
  sampleSize: number;
  timeRange: { from: string; to: string };
  confidence: number;
  createdAt: string;
};

export type LearningProposedChange = {
  kind: string;
  component: string;
  description: string;
  beforeSnapshot: Record<string, unknown>;
  afterSnapshot: Record<string, unknown>;
  elevatesAutonomy: boolean;
  removesConfirmation: boolean;
  expandsAllowlist: boolean;
  financial: boolean;
  sensitiveInference: boolean;
};

export type LearningProposal = {
  id: string;
  userId: string;
  ownerId: string;
  workspaceId: string | null;
  title: string;
  summary: string;
  proposalType: LearningProposalType;
  status: LearningProposalStatus;
  scope: LearningScope;
  context: {
    projectId: string | null;
    missionId: string | null;
    agentId: string | null;
    label: string;
  };
  supportingSignalIds: string[];
  counterSignalIds: string[];
  sampleSize: number;
  timeRange: { from: string; to: string };
  confidence: number;
  expectedBenefit: string;
  possibleRisk: string;
  proposedChange: LearningProposedChange;
  affectedComponents: string[];
  requiresConfirmation: true;
  validUntil: string;
  payloadHash: string;
  patternId: string | null;
  evaluationId: string | null;
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
  softDeleted: boolean;
  rowVersion: number;
};

export type LearningApplication = {
  id: string;
  proposalId: string;
  userId: string;
  appliedAt: string;
  snapshotBefore: Record<string, unknown>;
  snapshotAfter: Record<string, unknown>;
  reversible: boolean;
  revertedAt: string | null;
};

export type LearningEvaluation = {
  id: string;
  proposalId: string;
  applicationId: string;
  baselineMetric: number;
  currentMetric: number;
  windowFrom: string;
  windowTo: string;
  sampleSize: number;
  result: "SUCCESSFUL" | "UNSUCCESSFUL" | "INCONCLUSIVE";
  limitations: string[];
  completedAt: string | null;
};

export type LearningSuppression = {
  id: string;
  userId: string;
  workspaceId: string | null;
  proposalType: LearningProposalType;
  patternKey: string;
  reason: string;
  rejectedProposalId: string;
  createdAt: string;
  expiresAt: string | null;
};

export type LearningAuditEvent =
  | "learning_signal_created"
  | "learning_pattern_detected"
  | "learning_proposal_generated"
  | "learning_proposal_reviewed"
  | "learning_proposal_confirmed"
  | "learning_proposal_corrected"
  | "learning_proposal_rejected"
  | "learning_proposal_applied"
  | "learning_evaluation_started"
  | "learning_evaluation_completed"
  | "learning_proposal_reverted"
  | "learning_proposal_outdated"
  | "learning_proposal_archived"
  | "learning_policy_blocked"
  | "provider_invoked"
  | "provider_failed";

export type LearningAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  proposalId: string | null;
  event: LearningAuditEvent;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type LearningViewer = {
  userId: string;
  workspaceId: string | null;
  role: "owner" | "admin" | "member" | "viewer" | null;
  isWorkspaceMember: boolean;
};

export type LearningState = {
  signals: LearningSignal[];
  patterns: LearningPattern[];
  proposals: LearningProposal[];
  applications: LearningApplication[];
  evaluations: LearningEvaluation[];
  suppressions: LearningSuppression[];
  audits: LearningAuditEntry[];
  idempotencyIndex: Record<string, string>;
};

export type LearningAdapterDef = {
  sourceLayer: LearningSourceLayer;
  supportedEvents: string[];
  normalizationSchema: string;
  defaultWeight: number;
  sensitivity: "low" | "medium" | "high";
  scope: LearningScope;
  dedupePolicy: "idempotency_key" | "source_event";
  retentionDays: number;
};

export type RunLearningCycleInput = {
  viewer: LearningViewer;
  now?: string;
  minSampleSize?: number;
};

export type RunLearningCycleResult = {
  ok: boolean;
  error: string | null;
  patternsDetected: number;
  proposalsGenerated: number;
  proposalIds: string[];
};

export type LearningExplanation = {
  why: string;
  signals: string[];
  sources: string[];
  context: string;
  sampleSize: number;
  duplicatesRemoved: number;
  counterEvidence: string[];
  rules: string[];
  limitations: string[];
  exactChange: string;
};

export const MIN_SAMPLE_SIZE = 3;
export const PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EVALUATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const SUPPRESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const BLOCKED_APPLICATIONS = [
  "financial",
  "workspace_switch",
  "role_change",
  "permission",
  "deletion",
  "execution",
  "mission_create",
  "plan_approve",
  "publish",
  "external_send",
  "autonomy_elevate",
  "confirmation_remove",
  "allowlist_expand",
] as const;

export type LearningHomeWidget = {
  observedPatterns: Array<{ id: string; title: string }>;
  pendingReview: Array<{ id: string; title: string }>;
  applied: Array<{ id: string; title: string }>;
  evaluating: Array<{ id: string; title: string }>;
  needsMoreData: Array<{ id: string; title: string }>;
};
