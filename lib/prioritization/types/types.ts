/**
 * Sprint 7.2 — Prioritization Engine contracts.
 * Answers: "O que merece mais atenção agora?" — never "Faça isto."
 * Never executes. Never automates. Does not alter Planner / agents / Cognitive Kernel.
 * executionInfluence: always "none"
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const PRIORITY_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type PriorityEngineId =
  | "impact_prioritizer_v1"
  | "urgency_prioritizer_v1"
  | "confidence_prioritizer_v1"
  | "opportunity_prioritizer_v1"
  | "risk_prioritizer_v1"
  | "review_prioritizer_v1"
  | "stale_prioritizer_v1";

export type PriorityKind =
  | "IMPACT"
  | "URGENCY"
  | "CONFIDENCE"
  | "OPPORTUNITY"
  | "RISK"
  | "REVIEW"
  | "STALE";

export type PriorityStatus =
  | "SUGGESTED"
  | "CONFIRMED"
  | "IGNORED"
  | "ARCHIVED"
  | "NEEDS_REVIEW"
  | "OUTDATED";

export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";
export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";
export type EffortLevel = "LOW" | "MEDIUM" | "HIGH";
export type ReversibilityLevel = "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type PriorityFeedbackKind =
  | "confirm"
  | "ignore"
  | "archive"
  | "request_review";

export type PriorityEvidence = {
  id: string;
  evidenceType: string;
  sourceLayer:
    | "identity"
    | "memory"
    | "world"
    | "cognitive"
    | "discovery"
    | "knowledge"
    | "projects"
    | "business"
    | "decision"
    | "scenario";
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence: number;
  observedAt: string;
};

export type PriorityAlternativeView = {
  id: string;
  title: string;
  summary: string;
  scoreDelta?: number;
};

/**
 * Transparent score breakdown — weights documented in ranking.ts / SCORE_WEIGHTS.
 * Never invented by AI at runtime.
 */
export type PriorityScoreBreakdown = {
  impact: number;
  urgency: number;
  confidence: number;
  effort: number;
  reversibility: number;
  recency: number;
  completeness: number;
  total: number;
};

export type PriorityItem = {
  id: string;
  userId: string;
  workspaceId: string | null;
  engineId: PriorityEngineId;
  kind: PriorityKind;
  title: string;
  summary: string;
  priorityScore: number;
  scoreBreakdown: PriorityScoreBreakdown;
  confidence: number;
  confidenceBand: ConfidenceBand;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  effort: EffortLevel;
  reversibility: ReversibilityLevel;
  attentionReason: string;
  evidence: PriorityEvidence[];
  limitations: string[];
  alternativeViews: PriorityAlternativeView[];
  relatedDecision: string | null;
  relatedScenario: string | null;
  relatedProject: string | null;
  relatedDiscovery: string | null;
  relatedBusinessIds: string[];
  relatedDocumentIds: string[];
  relatedMemoryIds: string[];
  relatedEntityIds: string[];
  status: PriorityStatus;
  executionInfluence: "none";
  visibilityScope: VisibilityScope;
  explanation: string;
  criteriaContributed: string[];
  missingData: string[];
  ranking: number | null;
  fingerprint: string;
  signalObservedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
};

export type PriorityFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  priorityId: string;
  kind: PriorityFeedbackKind;
  note: string | null;
  actorUserId: string;
  createdAt: string;
};

export type PriorityAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  priorityId: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PriorityComparison = {
  id: string;
  userId: string;
  workspaceId: string | null;
  priorityIds: string[];
  title: string;
  scoreDiffs: Array<{
    priorityId: string;
    title: string;
    priorityScore: number;
    deltaFromLeader: number;
    breakdown: PriorityScoreBreakdown;
  }>;
  explanation: string;
  executionInfluence: "none";
  createdAt: string;
};

export type PrioritySourceSlice = {
  identityHints: Array<{ id: string; title: string; summary?: string }>;
  memories: Array<{
    id: string;
    title: string;
    summary?: string;
    confidence?: number;
    updatedAt?: string;
  }>;
  worldEntities: Array<{
    id: string;
    name: string;
    entityType?: string;
    summary?: string;
  }>;
  cognitiveArtifacts: Array<{
    id: string;
    title: string;
    summary: string;
    artifactType?: string;
    confidence: number;
    status?: string;
  }>;
  discoveries: Array<{
    id: string;
    title: string;
    summary: string;
    type: string;
    confidence: number;
    impact?: string;
    urgency?: string;
    status?: string;
    updatedAt?: string;
  }>;
  knowledgeDocuments: Array<{
    id: string;
    title: string;
    type: string;
    summary?: string;
    updatedAt?: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    description?: string;
    businessId?: string | null;
    updatedAt?: string;
  }>;
  businesses: Array<{
    id: string;
    name: string;
    segment?: string;
    description?: string;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    summary: string;
    kind: string;
    confidence: number;
    impact?: string;
    urgency?: string;
    status?: string;
    updatedAt?: string;
  }>;
  scenarios: Array<{
    id: string;
    title: string;
    description?: string;
    confidence: number;
    impact?: string;
    status?: string;
    updatedAt?: string;
  }>;
};

export type PriorityContext = {
  sources: PrioritySourceSlice;
  dataCompleteness: {
    score: number;
    gaps: string[];
    sampleSize: number;
  };
  generatedAt: string;
  correlationId: string;
  readOnly: true;
  executionInfluence: "none";
};

export type PriorityEngineCandidate = Omit<
  PriorityItem,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastReviewedAt"
  | "visibilityScope"
  | "ranking"
> & {
  visibilityScope?: VisibilityScope;
  ranking?: number | null;
};

export type PriorityEngine = {
  id: PriorityEngineId;
  kind: PriorityKind;
  label: string;
  description: string;
  prioritize(
    context: PriorityContext,
    options: {
      userId: string;
      workspaceId?: string | null;
      max?: number;
    }
  ): PriorityEngineCandidate[];
};

export type PriorityState = {
  items: PriorityItem[];
  feedback: PriorityFeedback[];
  audit: PriorityAuditEntry[];
  comparisons: PriorityComparison[];
  lastGeneratedAt: string | null;
};

export type PriorityHomeWidget = {
  weekPriorities: PriorityItem[];
};

export type PriorityExplanation = {
  priorityId: string;
  whyAppeared: string;
  criteriaContributed: string[];
  evidenceSummaries: string[];
  limitations: string[];
  missingData: string[];
  alternativeViews: string[];
  scoreBreakdown: PriorityScoreBreakdown;
  executionInfluence: "none";
};

export function createEmptyPriorityState(): PriorityState {
  return {
    items: [],
    feedback: [],
    audit: [],
    comparisons: [],
    lastGeneratedAt: null,
  };
}

export function newPriorityId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function confidenceBandOf(score: number): ConfidenceBand {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function canViewPriority(
  item: PriorityItem,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): boolean {
  if (item.userId === viewer.userId) return true;
  if (item.visibilityScope === "PRIVATE") return false;
  if (item.visibilityScope === "WORKSPACE") {
    return Boolean(
      viewer.isWorkspaceMember &&
        item.workspaceId &&
        viewer.workspaceId === item.workspaceId
    );
  }
  return false;
}

export const PRIORITY_KIND_LABELS: Record<PriorityKind, string> = {
  IMPACT: "Impacto",
  URGENCY: "Urgência",
  CONFIDENCE: "Confiança",
  OPPORTUNITY: "Oportunidade",
  RISK: "Risco",
  REVIEW: "Revisão",
  STALE: "Desatualizado",
};

export const PRIORITY_STATUS_LABELS: Record<PriorityStatus, string> = {
  SUGGESTED: "Sugerida",
  CONFIRMED: "Confirmada",
  IGNORED: "Ignorada",
  ARCHIVED: "Arquivada",
  NEEDS_REVIEW: "Em revisão",
  OUTDATED: "Desatualizada",
};
