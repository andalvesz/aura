/**
 * Sprint 7.0 — Decision Support Foundation contracts.
 * Analyzes and organizes possibilities only.
 * Never executes. Never automates. Does not alter Planner / agents / Cognitive Kernel.
 * executionInfluence: always "none"
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const DECISION_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type DecisionEngineId =
  | "priority_v1"
  | "tradeoff_v1"
  | "review_v1"
  | "opportunity_ranking_v1"
  | "risk_ranking_v1"
  | "missing_information_v1"
  | "stale_decision_v1";

export type DecisionKind =
  | "PRIORITY"
  | "TRADEOFF"
  | "REVIEW"
  | "OPPORTUNITY"
  | "RISK"
  | "MISSING_INFO"
  | "STALE";

export type DecisionStatus =
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

export type DecisionFeedbackKind =
  | "accept"
  | "ignore"
  | "archive"
  | "request_review";

export type DecisionEvidence = {
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
    | "decision";
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence: number;
  observedAt: string;
};

export type DecisionAlternative = {
  id: string;
  title: string;
  summary: string;
  pros: string[];
  cons: string[];
};

export type DecisionCard = {
  id: string;
  userId: string;
  workspaceId: string | null;
  engineId: DecisionEngineId;
  kind: DecisionKind;
  title: string;
  summary: string;
  context: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  effort: EffortLevel;
  reversibility: ReversibilityLevel;
  evidence: DecisionEvidence[];
  limitations: string[];
  alternativeOptions: DecisionAlternative[];
  status: DecisionStatus;
  executionInfluence: "none";
  visibilityScope: VisibilityScope;
  explanation: string;
  whyAppeared: string;
  relatedProjectIds: string[];
  relatedBusinessIds: string[];
  relatedDocumentIds: string[];
  relatedDiscoveryIds: string[];
  relatedMemoryIds: string[];
  relatedEntityIds: string[];
  fingerprint: string;
  tradeoff?: {
    advantages: string[];
    disadvantages: string[];
    risks: string[];
    uncertainties: string[];
  };
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
};

export type DecisionFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  decisionId: string;
  kind: DecisionFeedbackKind;
  note: string | null;
  actorUserId: string;
  createdAt: string;
};

export type DecisionAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  decisionId: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DecisionSourceSlice = {
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
  identityHints: Array<{ id: string; title: string; summary?: string }>;
};

export type DecisionContext = {
  sources: DecisionSourceSlice;
  dataCompleteness: {
    score: number;
    gaps: string[];
    sampleSize: number;
  };
  generatedAt: string;
  correlationId: string;
  /** Read-only marker for consumers */
  readOnly: true;
  executionInfluence: "none";
};

export type DecisionEngineCandidate = Omit<
  DecisionCard,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "lastReviewedAt"
  | "visibilityScope"
> & {
  visibilityScope?: VisibilityScope;
};

export type DecisionEngine = {
  id: DecisionEngineId;
  kind: DecisionKind;
  label: string;
  description: string;
  analyze(
    context: DecisionContext,
    options: {
      userId: string;
      workspaceId?: string | null;
      max?: number;
    }
  ): DecisionEngineCandidate[];
};

export type DecisionState = {
  cards: DecisionCard[];
  feedback: DecisionFeedback[];
  audit: DecisionAuditEntry[];
  lastGeneratedAt: string | null;
};

export type DecisionHomeWidget = {
  priorities: DecisionCard[];
  inReview: DecisionCard[];
  insufficientData: DecisionCard[];
};

export type DecisionExplanation = {
  decisionId: string;
  whyAppeared: string;
  evidenceSummaries: string[];
  limitations: string[];
  alternatives: string[];
  executionInfluence: "none";
};

export function createEmptyDecisionState(): DecisionState {
  return {
    cards: [],
    feedback: [],
    audit: [],
    lastGeneratedAt: null,
  };
}

export function newDecisionId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function confidenceBandOf(score: number): ConfidenceBand {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function canViewDecision(
  card: DecisionCard,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): boolean {
  if (card.userId === viewer.userId) return true;
  if (card.visibilityScope === "PRIVATE") return false;
  if (card.visibilityScope === "WORKSPACE") {
    return Boolean(
      viewer.isWorkspaceMember &&
        card.workspaceId &&
        viewer.workspaceId === card.workspaceId
    );
  }
  return false;
}

export const DECISION_KIND_LABELS: Record<DecisionKind, string> = {
  PRIORITY: "Prioridade",
  TRADEOFF: "Trade-off",
  REVIEW: "Revisão",
  OPPORTUNITY: "Oportunidade",
  RISK: "Risco",
  MISSING_INFO: "Dados insuficientes",
  STALE: "Decisão antiga",
};

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  SUGGESTED: "Sugerida",
  ACCEPTED: "Aceita",
  IGNORED: "Ignorada",
  ARCHIVED: "Arquivada",
  NEEDS_REVIEW: "Em revisão",
  OUTDATED: "Desatualizada",
};
