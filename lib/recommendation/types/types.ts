/**
 * Sprint 7.3 — Recommendation Engine contracts.
 * Answers: "O que faz mais sentido considerando tudo que eu sei até agora?"
 * Never: "Estou fazendo isso por você."
 * Never executes. Never creates tasks / Planner / automations / agents.
 * executionInfluence: always "none"
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const RECOMMENDATION_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type RecommendationEngineId =
  | "opportunity_recommender_v1"
  | "risk_recommender_v1"
  | "project_recommender_v1"
  | "learning_recommender_v1"
  | "relationship_recommender_v1"
  | "review_recommender_v1";

export type RecommendationType =
  | "OPPORTUNITY"
  | "RISK"
  | "PROJECT"
  | "LEARNING"
  | "RELATIONSHIP"
  | "REVIEW";

export type RecommendationStatus =
  | "SUGGESTED"
  | "ACCEPTED"
  | "IGNORED"
  | "ARCHIVED"
  | "NEEDS_REVIEW"
  | "OUTDATED";

export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";
export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";
export type EffortLevel = "LOW" | "MEDIUM" | "HIGH";
export type ReversibilityLevel = "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type RecommendationFeedbackKind =
  | "accept"
  | "ignore"
  | "archive"
  | "request_review";

export type RecommendationEvidence = {
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
    | "scenario"
    | "prioritization";
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence: number;
  observedAt: string;
};

export type RecommendationAlternative = {
  id: string;
  title: string;
  summary: string;
  scoreDelta?: number;
};

/**
 * Transparent score breakdown — weights documented in ranking.ts / SCORE_WEIGHTS.
 */
export type RecommendationScoreBreakdown = {
  impact: number;
  urgency: number;
  confidence: number;
  effort: number;
  reversibility: number;
  recency: number;
  completeness: number;
  total: number;
};

export type RecommendationReasoning = {
  whyAppeared: string;
  criteriaWeighted: string[];
  evidenceUsed: string[];
  missingInformation: string[];
  alternativesConsidered: string[];
};

export type RecommendationConflict = {
  conflictingRecommendationId: string;
  conflictingTitle: string;
  conflictSummary: string;
  sharedSourceIds: string[];
};

export type RecommendationCard = {
  id: string;
  userId: string;
  workspaceId: string | null;
  engineId: RecommendationEngineId;
  recommendationType: RecommendationType;
  title: string;
  summary: string;
  priorityScore: number;
  scoreBreakdown: RecommendationScoreBreakdown;
  confidence: number;
  confidenceBand: ConfidenceBand;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  effort: EffortLevel;
  reversibility: ReversibilityLevel;
  evidence: RecommendationEvidence[];
  limitations: string[];
  alternatives: RecommendationAlternative[];
  reasoning: RecommendationReasoning;
  relatedDecision: string | null;
  relatedScenario: string | null;
  relatedPriority: string | null;
  relatedProject: string | null;
  relatedDiscovery: string | null;
  relatedBusinessIds: string[];
  relatedDocumentIds: string[];
  relatedMemoryIds: string[];
  relatedEntityIds: string[];
  conflicts: RecommendationConflict[];
  status: RecommendationStatus;
  executionInfluence: "none";
  visibilityScope: VisibilityScope;
  explanation: string;
  criteriaContributed: string[];
  missingData: string[];
  ranking: number | null;
  fingerprint: string;
  signalObservedAt: string | null;
  pipelineSteps: string[];
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
};

export type RecommendationFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  recommendationId: string;
  kind: RecommendationFeedbackKind;
  note: string | null;
  actorUserId: string;
  createdAt: string;
};

export type RecommendationAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  recommendationId: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RecommendationSourceSlice = {
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
  priorities: Array<{
    id: string;
    title: string;
    summary: string;
    kind: string;
    confidence: number;
    priorityScore: number;
    impact?: string;
    urgency?: string;
    status?: string;
    updatedAt?: string;
  }>;
};

export type RecommendationContext = {
  sources: RecommendationSourceSlice;
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

export type RecommendationEngineCandidate = Omit<
  RecommendationCard,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastReviewedAt"
  | "visibilityScope"
  | "ranking"
  | "conflicts"
> & {
  visibilityScope?: VisibilityScope;
  ranking?: number | null;
  conflicts?: RecommendationConflict[];
};

export type RecommendationEngine = {
  id: RecommendationEngineId;
  recommendationType: RecommendationType;
  label: string;
  description: string;
  recommend(
    context: RecommendationContext,
    options: {
      userId: string;
      workspaceId?: string | null;
      max?: number;
    }
  ): RecommendationEngineCandidate[];
};

export type RecommendationState = {
  items: RecommendationCard[];
  feedback: RecommendationFeedback[];
  audit: RecommendationAuditEntry[];
  lastGeneratedAt: string | null;
};

export type RecommendationHomeWidget = {
  weekRecommendations: RecommendationCard[];
};

export type RecommendationExplanation = {
  recommendationId: string;
  whyAppeared: string;
  criteriaWeighted: string[];
  evidenceSummaries: string[];
  limitations: string[];
  missingInformation: string[];
  alternatives: string[];
  scoreBreakdown: RecommendationScoreBreakdown;
  pipelineSteps: string[];
  conflicts: RecommendationConflict[];
  executionInfluence: "none";
};

export function createEmptyRecommendationState(): RecommendationState {
  return {
    items: [],
    feedback: [],
    audit: [],
    lastGeneratedAt: null,
  };
}

export function newRecommendationId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function confidenceBandOf(score: number): ConfidenceBand {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function canViewRecommendation(
  item: RecommendationCard,
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

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  OPPORTUNITY: "Oportunidade",
  RISK: "Risco",
  PROJECT: "Projeto",
  LEARNING: "Aprendizado",
  RELATIONSHIP: "Relacionamento",
  REVIEW: "Revisão",
};

export const RECOMMENDATION_STATUS_LABELS: Record<
  RecommendationStatus,
  string
> = {
  SUGGESTED: "Sugerida",
  ACCEPTED: "Aceita",
  IGNORED: "Ignorada",
  ARCHIVED: "Arquivada",
  NEEDS_REVIEW: "Em revisão",
  OUTDATED: "Desatualizada",
};
