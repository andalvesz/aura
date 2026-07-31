/**
 * Sprint 8.0 — Planner V1 contracts.
 * Answers: "Como posso transformar esta recomendação em um plano?"
 * Never executes. Never creates tasks/events/automations without explicit approval.
 * Does not alter Cognitive Kernel. Does not replace lib/aura-brain/planner (action proposals).
 * executionInfluence: always "none"
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const PLAN_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type PlannerEngineId =
  | "goal_breakdown_v1"
  | "step_sequencing_v1"
  | "dependency_v1"
  | "resource_planning_v1"
  | "risk_planning_v1"
  | "milestone_v1"
  | "review_cadence_v1";

export type PlanStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type PlanStepStatus =
  | "DRAFT"
  | "READY"
  | "BLOCKED"
  | "APPROVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "CANCELLED";

export type PlanStepType =
  | "RESEARCH"
  | "DECIDE"
  | "PREPARE"
  | "EXECUTE_MANUAL"
  | "REVIEW"
  | "MILESTONE"
  | "OTHER";

export type PlanSourceKind =
  | "recommendation"
  | "decision"
  | "scenario"
  | "priority"
  | "project"
  | "mission"
  | "manual";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EffortLevel = "LOW" | "MEDIUM" | "HIGH";
export type ResourceAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "ABSENT"
  | "UNKNOWN";

export type ResourceKind =
  | "person"
  | "document"
  | "budget"
  | "tool"
  | "skill"
  | "knowledge"
  | "vendor"
  | "time";

export type PlanRole = "owner" | "editor" | "viewer";

export type PlanFeedbackKind =
  | "accurate"
  | "inaccurate"
  | "useful"
  | "not_useful"
  | "too_complex"
  | "too_simple"
  | "missing_step"
  | "wrong_order"
  | "wrong_deadline"
  | "wrong_owner"
  | "needs_review";

export type PlanDependencyIssueKind =
  | "step_dependency"
  | "circular"
  | "missing_resource"
  | "missing_owner"
  | "incompatible_deadline"
  | "external_block"
  | "insufficient_information";

export type PlanStep = {
  id: string;
  planId: string;
  title: string;
  description: string;
  order: number;
  status: PlanStepStatus;
  stepType: PlanStepType;
  ownerId: string | null;
  dependsOn: string[];
  suggestedStart: string | null;
  suggestedDeadline: string | null;
  estimatedEffort: EffortLevel;
  requiredResources: string[];
  successCriteria: string[];
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
};

export type PlanMilestone = {
  id: string;
  planId: string;
  title: string;
  description: string;
  targetDateSuggested: string | null;
  successCriteria: string[];
  relatedSteps: string[];
  status: "SUGGESTED" | "REACHED" | "MISSED" | "CANCELLED";
};

export type PlanResource = {
  id: string;
  planId: string;
  kind: ResourceKind;
  title: string;
  description: string;
  availability: ResourceAvailability;
  relatedStepIds: string[];
};

export type PlanRisk = {
  id: string;
  planId: string;
  title: string;
  impact: RiskLevel;
  probability: "LOW" | "MEDIUM" | "HIGH";
  evidence: string[];
  mitigationSuggested: string;
  alternativePlan: string;
};

export type PlanDependencyIssue = {
  id: string;
  planId: string;
  kind: PlanDependencyIssueKind;
  summary: string;
  relatedStepIds: string[];
  requiresHumanReview: true;
};

export type PlanComment = {
  id: string;
  planId: string;
  userId: string;
  body: string;
  mentions: string[];
  createdAt: string;
};

export type PlanFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  planId: string;
  stepId: string | null;
  kind: PlanFeedbackKind;
  note: string | null;
  actorUserId: string;
  createdAt: string;
};

export type PlanAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  planId: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PlanCollaborator = {
  userId: string;
  role: PlanRole;
};

export type PlanNotification = {
  id: string;
  userId: string;
  planId: string;
  kind:
    | "pending_approval"
    | "step_blocked"
    | "milestone_soon"
    | "comment"
    | "owner_assigned"
    | "review_requested";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type Plan = {
  id: string;
  title: string;
  summary: string;
  objective: string;
  status: PlanStatus;
  context: "personal" | "workspace";
  workspaceId: string | null;
  projectId: string | null;
  missionId: string | null;
  recommendationId: string | null;
  decisionId: string | null;
  scenarioId: string | null;
  priorityId: string | null;
  ownerId: string;
  createdBy: string;
  confidence: number;
  assumptions: string[];
  limitations: string[];
  successCriteria: string[];
  startDateSuggested: string | null;
  targetDateSuggested: string | null;
  estimatedEffort: EffortLevel;
  riskLevel: RiskLevel;
  sourceKind: PlanSourceKind;
  sourceId: string | null;
  steps: PlanStep[];
  milestones: PlanMilestone[];
  resources: PlanResource[];
  risks: PlanRisk[];
  dependencyIssues: PlanDependencyIssue[];
  collaborators: PlanCollaborator[];
  alternatives: string[];
  pipelineSteps: string[];
  visibilityScope: VisibilityScope;
  executionInfluence: "none";
  rowVersion: number;
  softDeleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlanSourceSlice = {
  identityHints: Array<{ id: string; title: string; summary?: string }>;
  memories: Array<{ id: string; title: string; summary?: string }>;
  worldEntities: Array<{ id: string; name: string; entityType?: string }>;
  cognitiveArtifacts: Array<{
    id: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
  discoveries: Array<{
    id: string;
    title: string;
    summary: string;
    type: string;
    confidence: number;
  }>;
  knowledgeDocuments: Array<{ id: string; title: string; type: string }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    description?: string;
  }>;
  businesses: Array<{ id: string; name: string }>;
  decisions: Array<{
    id: string;
    title: string;
    summary: string;
    confidence: number;
    status?: string;
  }>;
  scenarios: Array<{
    id: string;
    title: string;
    description?: string;
    confidence: number;
  }>;
  priorities: Array<{
    id: string;
    title: string;
    summary: string;
    confidence: number;
    priorityScore: number;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    summary: string;
    recommendationType: string;
    confidence: number;
    status?: string;
    relatedProject?: string | null;
    relatedDecision?: string | null;
    relatedScenario?: string | null;
    relatedPriority?: string | null;
    relatedDiscovery?: string | null;
    evidence?: Array<{ summary: string }>;
    limitations?: string[];
    alternatives?: Array<{ title: string; summary: string }>;
    reasoning?: { whyAppeared: string };
  }>;
  missions: Array<{
    id: string;
    title: string;
    objective?: string;
    status?: string;
  }>;
};

export type PlanContext = {
  sources: PlanSourceSlice;
  dataCompleteness: { score: number; gaps: string[]; sampleSize: number };
  generatedAt: string;
  correlationId: string;
  readOnly: true;
  executionInfluence: "none";
};

export type PlanDraftProposal = {
  title: string;
  summary: string;
  objective: string;
  assumptions: string[];
  limitations: string[];
  successCriteria: string[];
  estimatedEffort: EffortLevel;
  riskLevel: RiskLevel;
  confidence: number;
  steps: Omit<PlanStep, "id" | "planId">[];
  milestones: Omit<PlanMilestone, "id" | "planId">[];
  resources: Omit<PlanResource, "id" | "planId">[];
  risks: Omit<PlanRisk, "id" | "planId">[];
  alternatives: string[];
  pipelineSteps: string[];
  projectId?: string | null;
  missionId?: string | null;
  recommendationId?: string | null;
  decisionId?: string | null;
  scenarioId?: string | null;
  priorityId?: string | null;
  startDateSuggested?: string | null;
  targetDateSuggested?: string | null;
  sourceKind: PlanSourceKind;
  sourceId: string | null;
};

export type PlannerEngine = {
  id: PlannerEngineId;
  label: string;
  description: string;
  enrich(
    draft: PlanDraftProposal,
    context: PlanContext,
    options: { userId: string; workspaceId?: string | null }
  ): PlanDraftProposal;
};

export type PlanState = {
  plans: Plan[];
  feedback: PlanFeedback[];
  comments: PlanComment[];
  audit: PlanAuditEntry[];
  notifications: PlanNotification[];
  lastGeneratedAt: string | null;
};

export type PlanHomeWidget = {
  pendingApproval: Plan[];
  active: Plan[];
  blockedSteps: Array<{ planId: string; planTitle: string; step: PlanStep }>;
  upcomingMilestones: Array<{
    planId: string;
    planTitle: string;
    milestone: PlanMilestone;
  }>;
  withoutOwner: Plan[];
};

export type PlanExplanation = {
  planId: string;
  sources: string[];
  originRecommendation: string | null;
  evidence: string[];
  rulesUsed: string[];
  assumptions: string[];
  limitations: string[];
  alternatives: string[];
  humanDecisionPoints: string[];
  pipelineSteps: string[];
  executionInfluence: "none";
};

export function createEmptyPlanState(): PlanState {
  return {
    plans: [],
    feedback: [],
    comments: [],
    audit: [],
    notifications: [],
    lastGeneratedAt: null,
  };
}

export function newPlanId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function canViewPlan(
  plan: Plan,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): boolean {
  if (plan.softDeleted) return false;
  if (plan.ownerId === viewer.userId || plan.createdBy === viewer.userId)
    return true;
  if (plan.collaborators.some((c) => c.userId === viewer.userId)) return true;
  if (plan.visibilityScope === "PRIVATE") return false;
  if (plan.visibilityScope === "WORKSPACE") {
    return Boolean(
      viewer.isWorkspaceMember &&
        plan.workspaceId &&
        viewer.workspaceId === plan.workspaceId
    );
  }
  return false;
}

export function planRoleOf(
  plan: Plan,
  userId: string
): PlanRole | null {
  if (plan.ownerId === userId) return "owner";
  const c = plan.collaborators.find((x) => x.userId === userId);
  return c?.role ?? (plan.createdBy === userId ? "editor" : null);
}

export function canEditPlan(plan: Plan, userId: string): boolean {
  const role = planRoleOf(plan, userId);
  return role === "owner" || role === "editor";
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Aguardando aprovação",
  APPROVED: "Aprovado",
  IN_PROGRESS: "Em andamento",
  PAUSED: "Pausado",
  BLOCKED: "Bloqueado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};
