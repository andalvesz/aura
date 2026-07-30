/**
 * Discovery Engine V1 — contracts.
 * ADR-006 · ADR-005 · ADR-007 · ADR-008
 *
 * Read-only discovery signals. executionInfluence: "none"
 */

export type DiscoveryType =
  | "OPPORTUNITY"
  | "RISK"
  | "GAP"
  | "DEPENDENCY"
  | "STAGNATION"
  | "DUPLICATE"
  | "UNKNOWN";

/** Alias used in some docs */
export type DiscoveryArtifactType = DiscoveryType;

export type DiscoveryStatus =
  | "GENERATED"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "REJECTED"
  | "ARCHIVED"
  | "SUPPRESSED"
  | "OUTDATED"
  | "DELETED";

export type DiscoveryArtifactStatus = DiscoveryStatus;

export type DiscoverySensitivity =
  | "PUBLIC_PREF"
  | "STANDARD"
  | "SENSITIVE"
  | "RESTRICTED";

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";
export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";
export type UrgencyLevel = "LOW" | "MEDIUM" | "HIGH";
export type ReversibilityLevel = "HIGH" | "MEDIUM" | "LOW";

export type DiscoveryFeedbackKind =
  | "confirm"
  | "reject"
  | "archive"
  | "suppress_similar"
  | "useful"
  | "not_useful"
  | "outdated"
  | "needs_more_evidence";

export type FeedbackKind = DiscoveryFeedbackKind;

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type DiscoveryEvidence = {
  id: string;
  evidenceType: string;
  sourceLayer:
    | "identity"
    | "memory"
    | "world_model"
    | "cognitive"
    | "mission"
    | "user_feedback"
    | "discovery";
  sourceType: string;
  sourceId: string;
  sourceReference: SourceReference | null;
  observedAt: string;
  summary: string;
  confidence: number;
  supports: "supports" | "counter" | "neutral";
};

export type DiscoveryArtifact = {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: DiscoveryType;
  status: DiscoveryStatus;
  title: string;
  summary: string;
  description: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  reversibility: ReversibilityLevel;
  evidence: DiscoveryEvidence[];
  evidenceSetHash: string;
  relatedEntities: SourceReference[];
  relatedArtifacts: SourceReference[];
  relatedMemories: SourceReference[];
  relatedInsights: SourceReference[];
  limitations: string[];
  alternativeInterpretations: string[];
  explanation: string;
  origin: string;
  detectorId: string;
  method: string;
  methodVersion: string;
  suppressionKey: string;
  fingerprint: string;
  executionInfluence: "none";
  sensitivity: DiscoverySensitivity;
  /** RC2.1 visibility — default PRIVATE; WORKSPACE only when explicitly shared */
  visibilityScope: import("@/lib/aura-brain/visibility").VisibilityScope;
  /** Optimistic concurrency for collaborative feedback */
  rowVersion: number;
  validFrom: string | null;
  validUntil: string | null;
  firstGeneratedAt: string;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
};

export type DiscoveryFeedback = {
  id: string;
  userId: string;
  workspaceId: string | null;
  discoveryId: string;
  kind: DiscoveryFeedbackKind;
  note: string | null;
  /** Actor who performed the action (same as userId; kept explicit for UI history) */
  actorUserId: string;
  visibilityScope: import("@/lib/aura-brain/visibility").VisibilityScope;
  createdAt: string;
};

export type DiscoverySuppression = {
  id: string;
  userId: string;
  workspaceId: string | null;
  discoveryType: DiscoveryType | "*";
  semanticKey: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  brokenAt: string | null;
  breakReason: string | null;
  visibilityScope: import("@/lib/aura-brain/visibility").VisibilityScope;
};

export type DiscoveryAuditEvent = {
  id: string;
  userId: string;
  workspaceId: string | null;
  action: string;
  discoveryId: string | null;
  actor: "user" | "system";
  previousStatus: string | null;
  newStatus: string | null;
  justification: string;
  correlationId: string | null;
  sourceReferences: SourceReference[];
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type DiscoveryRun = {
  id: string;
  userId: string;
  workspaceId: string | null;
  correlationId: string;
  status: "started" | "completed" | "failed" | "dry_run";
  detectorsRun: number;
  artifactsGenerated: number;
  suppressedCount: number;
  reusedCount: number;
  durationMs: number;
  dryRun: boolean;
  /** Observability metrics (no memory content / secrets) */
  metrics: DiscoveryRunMetrics;
  createdAt: string;
  completedAt: string | null;
  report: Record<string, unknown>;
};

export type DiscoveryRunMetrics = {
  recordsAnalyzed: number;
  artifactsDeduplicated: number;
  artifactsSuppressed: number;
  feedbacks: number;
  failures: number;
  timeouts: number;
  cacheHit: boolean;
  detectorsExecuted: string[];
};

export type DiscoveryContextInput = {
  userId: string;
  workspaceId?: string | null;
  maxItems?: number;
  correlationId?: string;
};

export type DiscoveryIdentityClaim = {
  id: string;
  category: string;
  key: string;
  value: string;
  status: string;
  confidence: number;
};

export type DiscoveryContext = {
  /** Optional identity slice — detectors may ignore; kept for Aura Brain search. */
  identity: DiscoveryIdentityClaim[];
  cognitiveArtifacts: Array<{
    id: string;
    artifactType: string;
    title: string;
    summary: string;
    status: string;
    confidence: number;
    category: string;
  }>;
  memories: Array<{
    id: string;
    memoryType: string;
    title: string;
    status: string;
    confidence: number;
    summary: string;
    createdAt?: string;
  }>;
  worldEntities: Array<{
    id: string;
    entityType: string;
    displayName: string;
    status: string;
    confidence: number;
  }>;
  worldRelationships: Array<{
    id: string;
    relationshipType: string;
    sourceEntityId: string;
    targetEntityId: string;
    status: string;
    confidence: number;
    context?: string;
  }>;
  missions: Array<{
    id: string;
    title: string;
    status: string;
    type: string;
    progress: number | null;
  }>;
  dataCompleteness: {
    score: number;
    gaps: string[];
    sampleSize: number;
  };
  generatedAt: string;
  correlationId: string;
};

export type DiscoveryFilters = {
  types?: DiscoveryType[];
  statuses?: DiscoveryStatus[];
  minConfidence?: number;
  maxConfidence?: number;
  workspaceId?: string | null;
  periodFrom?: string;
  periodTo?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
};

export type DiscoveryBrainItem = {
  id: string;
  title: string;
  confidence: number;
};

export type DiscoveryBrainContext = {
  opportunities: DiscoveryBrainItem[];
  risks: DiscoveryBrainItem[];
  gaps: DiscoveryBrainItem[];
  pendingConfirmation: DiscoveryBrainItem[];
  recent: Array<{
    id: string;
    title: string;
    type: DiscoveryType;
    confidence: number;
  }>;
  topOpportunity?: DiscoveryBrainItem | null;
  topRisk?: DiscoveryBrainItem | null;
  recentTitles: string[];
  status: string;
  limitations: string[];
  executionInfluence: "none";
};

export type DiscoveryExplanation = {
  discoveryId: string;
  observed: string;
  supportingData: string[];
  limitations: string[];
  alternativeInterpretations: string[];
  confidence: number;
  confidenceBand: ConfidenceBand;
  method: string;
  methodVersion: string;
  justificationSummary: string;
  executionInfluence: "none";
  history: Array<{
    action: string;
    at: string;
    justification: string;
  }>;
};

export type DiscoveryBootstrapInput = {
  userId: string;
  workspaceId?: string | null;
  dryRun?: boolean;
  maxItems?: number;
  correlationId?: string;
  context?: DiscoveryContext;
};

export type DiscoveryBootstrapReport = {
  dryRun: boolean;
  artifactsGenerated: number;
  suppressedCount: number;
  reusedCount: number;
  correlationId: string;
  /** User-facing outcome code for bootstrap UI */
  outcome:
    | "generated"
    | "none_new"
    | "insufficient_evidence"
    | "migration_pending"
    | "error";
  message: string;
  durationMs: number;
  metrics: DiscoveryRunMetrics;
  items: Array<{
    type: DiscoveryType;
    title: string;
    discoveryId: string | null;
    detectorId: string;
  }>;
};

export type TimelineEventKind =
  | "memory"
  | "promotion"
  | "world"
  | "insight"
  | "discovery";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  title: string;
  summary: string;
  occurredAt: string;
  href: string;
  sourceId: string;
  /** RC2.1 collaborative timeline fields */
  actorUserId?: string | null;
  layer?: TimelineEventKind;
  origin?: string | null;
  workspaceId?: string | null;
  visibilityScope?: import("@/lib/aura-brain/visibility").VisibilityScope;
  meta?: Record<string, string | number | boolean | null>;
};

/** UI-facing timeline entry (uses `at` instead of `occurredAt`). */
export type DiscoveryTimelineEntry = {
  id: string;
  kind: TimelineEventKind;
  title: string;
  summary: string;
  at: string;
  href: string;
  sourceId?: string;
  actorUserId?: string | null;
  layer?: TimelineEventKind;
  origin?: string | null;
  workspaceId?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export type AuraBrainSearchResult = {
  id: string;
  kind: TimelineEventKind;
  title: string;
  summary: string;
  href: string;
  score: number;
};

export type GenerateDiscoveryOptions = {
  dryRun?: boolean;
  maxArtifacts?: number;
  correlationId?: string;
  detectorIds?: string[];
  workspaceId?: string | null;
};

export type DetectorCandidate = Omit<
  DiscoveryArtifact,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "archivedAt"
  | "deletedAt"
  | "firstGeneratedAt"
  | "lastValidatedAt"
  | "confidenceBand"
  | "visibilityScope"
  | "rowVersion"
> & {
  confidenceBand?: ConfidenceBand;
  visibilityScope?: import("@/lib/aura-brain/visibility").VisibilityScope;
};

export type DiscoveryDetector = {
  id: string;
  type: DiscoveryType;
  label: string;
  description: string;
  detect: (
    context: DiscoveryContext,
    options: { userId: string; workspaceId: string | null; max?: number }
  ) => DetectorCandidate[];
};

export const METHOD_VERSION = "discovery-engine-v1";
export const CONFIDENCE_METHOD_VERSION = "discovery-confidence-v1";
export const DEFAULT_SUPPRESSION_DAYS = 14;
export const EXECUTION_INFLUENCE_NONE = "none" as const;
