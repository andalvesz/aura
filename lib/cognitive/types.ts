/**
 * Cognitive Engine V1 — contracts.
 * ADR-008 · ADR-005 · ADR-007 · RFC-005
 *
 * Explainable reasoning over Identity/Memory/World Model.
 * Never mutates sources. Never executes. No user-specific hardcoding.
 * executionInfluence: "none"
 */

export type CognitiveArtifactType =
  | "PATTERN"
  | "CONFLICT"
  | "PROGRESS_OBSERVATION"
  | "HYPOTHESIS"
  | "INSIGHT"
  | "RISK_SIGNAL"
  | "RECOMMENDATION"
  | "CLARIFYING_QUESTION"
  | "INSUFFICIENT_EVIDENCE"
  | "DATA_QUALITY_WARNING";

export type CognitiveArtifactStatus =
  | "DRAFT"
  | "GENERATED"
  | "VALIDATED"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "CORRECTED"
  | "REJECTED"
  | "SUPERSEDED"
  | "OUTDATED"
  | "ARCHIVED"
  | "DELETED";

export type CognitiveSensitivity =
  | "PUBLIC_PREF"
  | "STANDARD"
  | "SENSITIVE"
  | "RESTRICTED";

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type EvidenceSourceLayer =
  | "identity"
  | "memory"
  | "world_model"
  | "mission"
  | "planner"
  | "domain"
  | "user_feedback"
  | "cognitive_artifact";

export type RecommendationType =
  | "REVIEW"
  | "ORGANIZE"
  | "CLARIFY"
  | "COMPARE"
  | "TEST"
  | "MONITOR"
  | "PAUSE"
  | "ARCHIVE"
  | "REQUEST_CONFIRMATION"
  | "COLLECT_MORE_DATA";

export type ConflictNature =
  | "contradiction"
  | "temporal_change"
  | "contextual_difference"
  | "source_disagreement"
  | "stale_information"
  | "unresolved_identity"
  | "invalid_projection";

export type PatternKind =
  | "frequency"
  | "sequence"
  | "recurrence"
  | "consistency"
  | "abandonment"
  | "completion"
  | "acceptance"
  | "rejection"
  | "delay"
  | "temporal_repetition"
  | "simple_association"
  | "trend_change"
  | "context_concentration"
  | "category_distribution";

export type FeedbackKind =
  | "accurate"
  | "inaccurate"
  | "useful"
  | "not_useful"
  | "obvious"
  | "irrelevant"
  | "outdated"
  | "sensitive"
  | "misunderstood"
  | "needs_more_evidence"
  | "confirm"
  | "reject"
  | "correct"
  | "suppress_similar";

export type ValidatorDisposition =
  | "ACCEPT"
  | "REVISE"
  | "PENDING_REVIEW"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED"
  | "SUPPRESSED";

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type CognitiveEvidence = {
  id: string;
  evidenceType: string;
  sourceLayer: EvidenceSourceLayer;
  sourceType: string;
  sourceId: string;
  sourceReference: SourceReference | null;
  observedAt: string;
  context: string;
  confidence: number;
  authority: number;
  independenceKey: string;
  summary: string;
  sensitivity: CognitiveSensitivity;
  relevance: number;
  supports: "supports" | "counter" | "neutral";
  relationshipToClaim: string;
};

export type AlternativeHypothesis = {
  statement: string;
  confidence: number;
  rationale: string;
};

export type Assumption = {
  statement: string;
  required: boolean;
};

export type TimeRange = {
  from: string | null;
  to: string | null;
  label?: string;
};

export type CognitiveArtifact = {
  id: string;
  userId: string;
  workspaceId: string | null;
  artifactType: CognitiveArtifactType;
  category: string;
  status: CognitiveArtifactStatus;
  title: string;
  summary: string;
  structuredContent: Record<string, unknown>;
  subjectReferences: SourceReference[];
  entityReferences: SourceReference[];
  memoryReferences: SourceReference[];
  identityClaimReferences: SourceReference[];
  missionReferences: SourceReference[];
  evidence: CognitiveEvidence[];
  counterEvidence: CognitiveEvidence[];
  assumptions: Assumption[];
  alternativeHypotheses: AlternativeHypothesis[];
  method: string;
  methodVersion: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  confidenceMethodVersion: string;
  evidenceConfidence: number;
  patternConfidence: number | null;
  hypothesisConfidence: number | null;
  insightConfidence: number | null;
  recommendationConfidence: number | null;
  importance: number;
  impact: number;
  novelty: number;
  actionability: number;
  sensitivity: CognitiveSensitivity;
  timeRange: TimeRange;
  validFrom: string | null;
  validUntil: string | null;
  firstGeneratedAt: string;
  lastValidatedAt: string | null;
  supersedesArtifactId: string | null;
  supersededByArtifactId: string | null;
  suppressionKey: string | null;
  fingerprint: string;
  evidenceSetHash: string;
  generatedBy: "deterministic" | "hybrid" | "provider";
  providerMetadata: {
    provider: string;
    version: string | null;
    used: boolean;
  } | null;
  executionInfluence: "none";
  limitations: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
};

export type CognitiveFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  artifactId: string;
  kind: FeedbackKind;
  note: string | null;
  correctionPayload: Record<string, unknown> | null;
  createdAt: string;
};

export type CognitiveSuppression = {
  id: string;
  userId: string;
  workspaceId: string | null;
  artifactType: CognitiveArtifactType | "*";
  category: string | null;
  semanticKey: string;
  context: string | null;
  sourceSetHash: string | null;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  brokenAt: string | null;
  breakReason: string | null;
};

export type CognitiveRun = {
  id: string;
  userId: string;
  workspaceId: string | null;
  correlationId: string;
  status: "started" | "completed" | "failed" | "cancelled" | "dry_run";
  contextType: string;
  artifactsGenerated: number;
  insufficientCount: number;
  blockedCount: number;
  durationMs: number;
  dryRun: boolean;
  createdAt: string;
  completedAt: string | null;
  report: Record<string, unknown>;
};

export type CognitiveAuditEvent = {
  id: string;
  userId: string;
  workspaceId: string | null;
  action: string;
  artifactId: string | null;
  actor: "user" | "system" | "provider";
  previousStatus: string | null;
  newStatus: string | null;
  method: string | null;
  methodVersion: string | null;
  provider: string | null;
  validatorDisposition: ValidatorDisposition | null;
  justification: string;
  correlationId: string | null;
  sourceReferences: SourceReference[];
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type CognitiveContextInput = {
  userId: string;
  workspaceId?: string | null;
  contextType?: string;
  subjectIds?: string[];
  entityIds?: string[];
  missionIds?: string[];
  memoryIds?: string[];
  timeRange?: TimeRange;
  requestedCapabilities?: string[];
  sensitivityScope?: CognitiveSensitivity[];
  maxItems?: number;
  correlationId?: string;
};

export type CognitiveContext = {
  identityContext: {
    claims: Array<{
      id: string;
      category: string;
      key: string;
      value: string;
      status: string;
      confidence: number;
      contextScope: string;
    }>;
  };
  memoryContext: {
    memories: Array<{
      id: string;
      memoryType: string;
      title: string;
      status: string;
      confidence: number;
      summary: string;
    }>;
  };
  worldContext: {
    entities: Array<{
      id: string;
      entityType: string;
      displayName: string;
      status: string;
      confidence: number;
    }>;
    relationships: Array<{
      id: string;
      relationshipType: string;
      sourceEntityId: string;
      targetEntityId: string;
      status: string;
      confidence: number;
      context: string;
    }>;
  };
  missionContext: {
    missions: Array<{
      id: string;
      title: string;
      status: string;
      type: string;
      progress: number | null;
    }>;
  };
  temporalContext: TimeRange;
  evidenceIndex: CognitiveEvidence[];
  constraints: string[];
  exclusions: string[];
  dataCompleteness: {
    score: number;
    gaps: string[];
    sampleSize: number;
  };
  generatedAt: string;
  correlationId: string;
};

export type ValidatorResult = {
  valid: boolean;
  disposition: ValidatorDisposition;
  issues: string[];
  confidenceAdjustment: number;
  requiredChanges: string[];
  explanation: string;
};

export type CognitiveExplanation = {
  artifactId: string;
  observed: string;
  supportingData: string[];
  period: string;
  context: string;
  limitations: string[];
  counterEvidence: string[];
  alternativeHypotheses: string[];
  confidence: number;
  confidenceBand: ConfidenceBand;
  userConfirmed: boolean;
  generatedAction: boolean;
  method: string;
  methodVersion: string;
  premises: string[];
  rulesApplied: string[];
  justificationSummary: string;
  executionInfluence: "none";
};

export type CognitiveBrainContext = {
  patterns: Array<{ id: string; title: string; confidence: number }>;
  insights: Array<{ id: string; title: string; confidence: number }>;
  conflicts: Array<{ id: string; title: string; confidence: number }>;
  hypotheses: Array<{ id: string; title: string; confidence: number }>;
  recommendations: Array<{ id: string; title: string; confidence: number }>;
  evidenceSummary: string[];
  status: string;
  limitations: string[];
  executionInfluence: "none";
};

export type ArtifactFilters = {
  artifactTypes?: CognitiveArtifactType[];
  statuses?: CognitiveArtifactStatus[];
  category?: string;
  minConfidence?: number;
  workspaceId?: string | null;
  subjectId?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
};

export type GenerateOptions = {
  dryRun?: boolean;
  maxArtifacts?: number;
  timeoutMs?: number;
  enableProvider?: boolean;
  correlationId?: string;
  capabilities?: Array<
    | "patterns"
    | "conflicts"
    | "progress"
    | "hypotheses"
    | "insights"
    | "recommendations"
  >;
};

export type CognitiveBootstrapInput = {
  userId: string;
  workspaceId?: string | null;
  dryRun?: boolean;
  maxItems?: number;
  timeRange?: TimeRange;
  correlationId?: string;
  identityClaims?: CognitiveContext["identityContext"]["claims"];
  memories?: CognitiveContext["memoryContext"]["memories"];
  worldEntities?: CognitiveContext["worldContext"]["entities"];
  worldRelationships?: CognitiveContext["worldContext"]["relationships"];
  missions?: CognitiveContext["missionContext"]["missions"];
};

export type CognitiveBootstrapReport = {
  dryRun: boolean;
  artifactsGenerated: number;
  insufficientCount: number;
  blockedCount: number;
  reusedCount: number;
  items: Array<{
    artifactType: CognitiveArtifactType;
    title: string;
    disposition: ValidatorDisposition;
    artifactId: string | null;
  }>;
};

export const CONFIDENCE_METHOD_VERSION = "cognitive-confidence-v1";
export const METHOD_VERSION = "cognitive-engine-v1";
export const MIN_PATTERN_SAMPLE = 3;
export const MAX_INFERENCE_CONFIDENCE = 95;
