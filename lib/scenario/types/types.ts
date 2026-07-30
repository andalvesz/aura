/**
 * Sprint 7.1 — Scenario Engine contracts.
 * Hypothetical simulations only. Never executes.
 * Does not alter Planner / agents / Cognitive Kernel / Decision Support writes.
 * executionInfluence: always "none"
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";
import { EXECUTION_INFLUENCE_NONE } from "@/lib/aura-kernel/source-reference";

export const SCENARIO_EXECUTION_INFLUENCE = EXECUTION_INFLUENCE_NONE;

export type ScenarioType =
  | "BEST_CASE"
  | "WORST_CASE"
  | "MOST_LIKELY"
  | "OPTIMISTIC"
  | "CONSERVATIVE"
  | "NEUTRAL";

export type ScenarioStatus =
  | "DRAFT"
  | "SAVED"
  | "ARCHIVED"
  | "DISCARDED"
  | "COMPARED";

export type ScenarioImpact = "LOW" | "MEDIUM" | "HIGH";

export type ScenarioFeedbackKind =
  | "save"
  | "archive"
  | "compare"
  | "discard";

export type ScenarioEngineId =
  | "what_if_v1"
  | "best_case_v1"
  | "worst_case_v1"
  | "most_likely_v1"
  | "optimistic_v1"
  | "conservative_v1"
  | "neutral_v1"
  | "comparison_v1";

export type ScenarioEvidence = {
  id: string;
  evidenceType: string;
  sourceLayer:
    | "memory"
    | "world"
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
  used: boolean;
};

export type ScenarioAssumption = {
  id: string;
  statement: string;
  confidence: number;
  source?: string;
};

export type ScenarioTimelineEvent = {
  id: string;
  label: string;
  phase: "premise" | "near" | "mid" | "far";
  summary: string;
  confidence: number;
};

export type ScenarioAlternative = {
  id: string;
  title: string;
  scenarioType: ScenarioType;
  summary: string;
};

export type ScenarioCard = {
  id: string;
  userId: string;
  workspaceId: string | null;
  engineId: ScenarioEngineId;
  scenarioType: ScenarioType;
  title: string;
  description: string;
  status: ScenarioStatus;
  context: string;
  confidence: number;
  impact: ScenarioImpact;
  assumptions: ScenarioAssumption[];
  limitations: string[];
  evidence: ScenarioEvidence[];
  alternativeScenarios: ScenarioAlternative[];
  relatedDecisionId: string | null;
  relatedProjectId: string | null;
  relatedDiscoveryId: string | null;
  relatedBusinessId: string | null;
  relatedDocumentIds: string[];
  relatedMemoryIds: string[];
  whatIfPrompt: string | null;
  ignoredData: string[];
  whyResult: string;
  timeline: ScenarioTimelineEvent[];
  uncertainty: {
    hypotheses: string[];
    missingData: string[];
    limitations: string[];
  };
  comparisonGroupId: string | null;
  executionInfluence: "none";
  visibilityScope: VisibilityScope;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  scenarioId: string;
  kind: ScenarioFeedbackKind;
  note: string | null;
  actorUserId: string;
  createdAt: string;
};

export type ScenarioAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string | null;
  scenarioId: string | null;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ScenarioComparison = {
  id: string;
  userId: string;
  workspaceId: string | null;
  scenarioIds: string[];
  title: string;
  advantages: string[];
  disadvantages: string[];
  risks: string[];
  opportunities: string[];
  missingData: string[];
  explanation: string;
  executionInfluence: "none";
  createdAt: string;
};

export type ScenarioSourceSlice = {
  memories: Array<{ id: string; title: string; summary?: string; confidence?: number }>;
  worldEntities: Array<{ id: string; name: string; entityType?: string; summary?: string }>;
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
  knowledgeDocuments: Array<{ id: string; title: string; type: string; summary?: string }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    description?: string;
    businessId?: string | null;
  }>;
  businesses: Array<{ id: string; name: string; segment?: string; description?: string }>;
  decisions: Array<{
    id: string;
    title: string;
    summary: string;
    kind: string;
    confidence: number;
    status?: string;
  }>;
};

export type ScenarioContext = {
  sources: ScenarioSourceSlice;
  dataCompleteness: { score: number; gaps: string[]; sampleSize: number };
  generatedAt: string;
  correlationId: string;
  readOnly: true;
  executionInfluence: "none";
  whatIfPrompt?: string | null;
};

export type ScenarioEngineCandidate = Omit<
  ScenarioCard,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "visibilityScope"
  | "comparisonGroupId"
> & {
  visibilityScope?: VisibilityScope;
  comparisonGroupId?: string | null;
};

export type ScenarioEngine = {
  id: ScenarioEngineId;
  scenarioType: ScenarioType | "COMPARISON" | "WHAT_IF";
  label: string;
  description: string;
  simulate(
    context: ScenarioContext,
    options: {
      userId: string;
      workspaceId?: string | null;
      max?: number;
      whatIfPrompt?: string | null;
      relatedDecisionId?: string | null;
      relatedProjectId?: string | null;
    }
  ): ScenarioEngineCandidate[];
};

export type ScenarioState = {
  scenarios: ScenarioCard[];
  feedback: ScenarioFeedback[];
  audit: ScenarioAuditEntry[];
  comparisons: ScenarioComparison[];
  lastGeneratedAt: string | null;
};

export type ScenarioHomeWidget = {
  recent: ScenarioCard[];
};

export type ScenarioExplanation = {
  scenarioId: string;
  usedData: string[];
  ignoredData: string[];
  whyResult: string;
  assumptions: string[];
  limitations: string[];
  executionInfluence: "none";
};

export const SCENARIO_TYPE_LABELS: Record<ScenarioType, string> = {
  BEST_CASE: "Melhor caso",
  WORST_CASE: "Pior caso",
  MOST_LIKELY: "Mais provável",
  OPTIMISTIC: "Otimista",
  CONSERVATIVE: "Conservador",
  NEUTRAL: "Neutro",
};

export const SCENARIO_STATUS_LABELS: Record<ScenarioStatus, string> = {
  DRAFT: "Rascunho",
  SAVED: "Salvo",
  ARCHIVED: "Arquivado",
  DISCARDED: "Descartado",
  COMPARED: "Comparado",
};

export function createEmptyScenarioState(): ScenarioState {
  return {
    scenarios: [],
    feedback: [],
    audit: [],
    comparisons: [],
    lastGeneratedAt: null,
  };
}

export function newScenarioId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function canViewScenario(
  card: ScenarioCard,
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
