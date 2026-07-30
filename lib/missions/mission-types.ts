/**
 * Mission Engine V1 — shared contracts.
 * Structured outputs only — never free-form chat as primary result.
 */

export type MissionType =
  | "PERSONAL"
  | "BUSINESS"
  | "LEARNING"
  | "HEALTH"
  | "FINANCIAL"
  | "TRAVEL"
  | "CUSTOM";

export type MissionStatus =
  | "PLANNING"
  | "ACTIVE"
  | "PAUSED"
  | "BLOCKED"
  | "COMPLETED"
  | "ARCHIVED";

export type MissionModuleId =
  | "calendario"
  | "financeiro"
  | "saude"
  | "habitos"
  | "objetivos"
  | "viagens"
  | "idiomas"
  | "expert_brain"
  | "business_lab"
  | "planner"
  | "automation"
  | "sistema";

export type MissionTaskStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type MissionPhaseStatus =
  | "pending"
  | "active"
  | "blocked"
  | "done"
  | "skipped";

export type MissionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MissionRiskStatus = "open" | "mitigated" | "accepted" | "closed";

export type MissionInsightKind =
  | "stalled"
  | "progressed"
  | "at_risk"
  | "ahead"
  | "blocked"
  | "completed";

export type MissionGoal = {
  id: string;
  missionId: string;
  title: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  dueDate: string | null;
};

export type MissionPhase = {
  id: string;
  missionId: string;
  order: number;
  title: string;
  description: string;
  status: MissionPhaseStatus;
  estimatedDays: number;
  moduleIds: MissionModuleId[];
  progressPct: number;
};

export type MissionMilestone = {
  id: string;
  missionId: string;
  phaseId: string;
  order: number;
  title: string;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
};

export type MissionTask = {
  id: string;
  missionId: string;
  phaseId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: MissionTaskStatus;
  moduleId: MissionModuleId;
  estimatedHours: number;
  dueDate: string | null;
  blockedBy: string[];
  riskLevel: MissionRiskLevel;
};

export type MissionRisk = {
  id: string;
  missionId: string;
  title: string;
  description: string;
  level: MissionRiskLevel;
  status: MissionRiskStatus;
  relatedTaskIds: string[];
  mitigation: string;
};

export type MissionMetric = {
  id: string;
  missionId: string;
  key: string;
  label: string;
  value: number;
  target: number | null;
  unit: string | null;
};

export type MissionDependency = {
  id: string;
  missionId: string;
  fromTaskId: string;
  toTaskId: string;
  reason: string;
};

export type MissionResource = {
  id: string;
  missionId: string;
  kind: "money" | "time" | "skill" | "tool" | "people" | "document" | "other";
  title: string;
  amount: number | null;
  unit: string | null;
  notes: string;
};

export type MissionRecommendation = {
  id: string;
  missionId: string;
  title: string;
  description: string;
  actionId: string | null;
  riskLevel: MissionRiskLevel;
  moduleId: MissionModuleId;
  reason: string;
  /** Never auto-execute HIGH/CRITICAL */
  autoExecutable: boolean;
};

export type MissionProgressBreakdown = {
  key: string;
  label: string;
  pct: number;
  moduleId: MissionModuleId | null;
};

export type MissionProgress = {
  totalPct: number;
  breakdown: MissionProgressBreakdown[];
  completedTasks: number;
  totalTasks: number;
  completedMilestones: number;
  totalMilestones: number;
  remainingDays: number | null;
  estimatedTotalDays: number;
};

export type MissionScore = {
  priority: number;
  risk: number;
  confidence: number;
  remainingTime: number;
  health: number;
  overall: number;
};

export type MissionInsight = {
  id: string;
  missionId: string;
  kind: MissionInsightKind;
  title: string;
  description: string;
  severity: MissionRiskLevel;
};

export type BusinessHypothesisDraft = {
  id: string;
  missionId: string;
  statement: string;
  evidence: string[];
};

export type BusinessExperimentDraft = {
  id: string;
  missionId: string;
  hypothesisId: string;
  method: string;
  status: "planned" | "running" | "done" | "cancelled";
};

export type BusinessOpportunityDraft = {
  id: string;
  missionId: string;
  title: string;
  problem: string;
  audience: string;
};

export type Mission = {
  id: string;
  userId: string;
  workspaceId: string | null;
  title: string;
  description: string;
  type: MissionType;
  status: MissionStatus;
  priority: number;
  startDate: string | null;
  targetDate: string | null;
  modules: MissionModuleId[];
  goals: MissionGoal[];
  phases: MissionPhase[];
  milestones: MissionMilestone[];
  tasks: MissionTask[];
  risks: MissionRisk[];
  metrics: MissionMetric[];
  dependencies: MissionDependency[];
  resources: MissionResource[];
  recommendations: MissionRecommendation[];
  progress: MissionProgress;
  score: MissionScore;
  insights: MissionInsight[];
  /** BUSINESS only — never auto-creates companies */
  business?: {
    hypotheses: BusinessHypothesisDraft[];
    experiments: BusinessExperimentDraft[];
    opportunities: BusinessOpportunityDraft[];
  };
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  metadata: Record<string, unknown>;
};

export type MissionCreateInput = {
  title: string;
  description?: string;
  type: MissionType;
  priority?: number;
  targetDate?: string | null;
  startDate?: string | null;
  workspaceId?: string | null;
  templateId?: string | null;
  metadata?: Record<string, unknown>;
};

export type MissionEngineInput = {
  userId: string;
  workspaceId?: string | null;
  mode: "personal" | "workspace";
  asOf?: string;
  missions?: Mission[];
  create?: MissionCreateInput[];
  /** Signals from Intelligence Engine (optional reuse) */
  intelligence?: {
    priorities?: { id: string; level: string; title: string; module: string }[];
    alerts?: { id: string; severity: string; title: string }[];
    score?: { overall: number };
  };
};

export type MissionOfTheDay = {
  missionId: string;
  missionTitle: string;
  expectedAdvancePct: number;
  message: string;
  nextTask: MissionTask | null;
  nextMilestone: MissionMilestone | null;
};

export type MissionSuggestedAction = {
  id: string;
  missionId: string;
  title: string;
  reason: string;
  actionId: string;
  riskLevel: MissionRiskLevel;
  autoExecutable: boolean;
  input: Record<string, unknown>;
};

export type MissionEngineResult = {
  missions: Mission[];
  active: Mission[];
  missionOfTheDay: MissionOfTheDay | null;
  insights: MissionInsight[];
  suggestedActions: MissionSuggestedAction[];
  /** Safe automation proposals — never HIGH/CRITICAL auto */
  automationProposals: MissionSuggestedAction[];
  meta: {
    generatedAt: string;
    plannerMs: number;
    progressMs: number;
    totalMs: number;
    createdCount: number;
  };
};

export type MissionTemplatePhase = {
  title: string;
  description: string;
  estimatedDays: number;
  moduleIds: MissionModuleId[];
  milestones: string[];
  tasks: {
    title: string;
    description: string;
    moduleId: MissionModuleId;
    estimatedHours: number;
    riskLevel?: MissionRiskLevel;
  }[];
};

export type MissionTemplate = {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  estimatedDays: number;
  modules: MissionModuleId[];
  resources: Omit<MissionResource, "id" | "missionId">[];
  phases: MissionTemplatePhase[];
  defaultRisks: {
    title: string;
    description: string;
    level: MissionRiskLevel;
    mitigation: string;
  }[];
};
