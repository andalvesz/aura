/**
 * Memory Engine V1 — contracts.
 * ADR-003 · ADR-003 Addendum · ADR-005 · ADR-007 · RFC-001 / RFC-003
 *
 * Memory is historical experience. It never silently overwrites confirmed Identity.
 * No user-specific hardcoding. No clinical/psychological labels.
 */

export type MemoryType =
  | "EPISODIC"
  | "SEMANTIC"
  | "PROCEDURAL"
  | "REFLECTIVE";

export type MemoryStatus =
  | "ACTIVE"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "CORRECTED"
  | "SUPERSEDED"
  | "REJECTED"
  | "OUTDATED"
  | "ARCHIVED"
  | "DELETED";

export type MemoryPromotionStatus =
  | "NONE"
  | "EVALUATED"
  | "QUEUED_FOR_REVIEW"
  | "PROPOSED_IDENTITY"
  | "ATTACHED_EVIDENCE"
  | "FUTURE_GRAPH_CANDIDATE"
  | "BLOCKED"
  | "PROMOTED";

export type RetentionPolicy =
  | "permanent"
  | "long_term"
  | "standard"
  | "short_term"
  | "session"
  | "until_date"
  | "user_managed";

export type MemorySensitivity =
  | "PUBLIC_PREF"
  | "STANDARD"
  | "SENSITIVE"
  | "RESTRICTED";

export type ConsentScope =
  | "personal"
  | "workspace"
  | "shared"
  | "system";

export type ExperienceType =
  | "user_statement"
  | "user_feedback"
  | "mission_created"
  | "mission_updated"
  | "mission_completed"
  | "task_completed"
  | "calendar_event_created"
  | "calendar_event_completed"
  | "financial_transaction_created"
  | "business_record_created"
  | "document_added"
  | "preference_changed"
  | "identity_claim_confirmed"
  | "identity_claim_rejected"
  | "planner_recommendation_accepted"
  | "planner_recommendation_ignored"
  | "execution_succeeded"
  | "execution_failed"
  | "manual_memory_entry"
  | "system_observation"
  | "search_or_browse"
  | (string & {});

export type MemorySourceType =
  | "user_explicit"
  | "user_feedback"
  | "mission_engine"
  | "calendar"
  | "finance"
  | "health"
  | "business"
  | "conversation"
  | "manual_entry"
  | "system_observation"
  | "imported_data"
  | "discovery_engine"
  | "planner"
  | "execution_result"
  | "bootstrap_confirmed"
  | "identity_engine"
  | "search_or_browse"
  | (string & {});

export type ActorType = "user" | "system" | "automation" | "bootstrap";

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type MemoryFeedbackKind =
  | "accurate"
  | "inaccurate"
  | "outdated"
  | "irrelevant"
  | "useful"
  | "sensitive"
  | "forget"
  | "correct";

export type PromotionDecision =
  | "NO_PROMOTION"
  | "PROPOSE_IDENTITY_CLAIM"
  | "ATTACH_IDENTITY_EVIDENCE"
  | "QUEUE_FOR_REVIEW"
  | "FUTURE_GRAPH_CANDIDATE";

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type MemorySubject = {
  subjectType: string;
  subjectId: string;
  label?: string;
};

export type MemoryEvidence = {
  id: string;
  observedAt: string;
  sourceType: MemorySourceType;
  sourceReference: SourceReference | null;
  summary: string;
  strength: number;
  metadata?: Record<string, unknown>;
};

export type ScoreHistoryEntry = {
  at: string;
  field: "confidence" | "importance" | "weight";
  from: number;
  to: number;
  reason: string;
  actor: "user" | "system";
};

export type EpisodicContent = {
  kind: "episodic";
  when: string;
  where?: string | null;
  participants?: MemorySubject[];
  sequenceKey?: string | null;
  correlationId?: string | null;
  summary: string;
};

export type SemanticContent = {
  kind: "semantic";
  factKey: string;
  factValue: unknown;
  contextScope?: string;
  summary: string;
};

export type ProceduralContent = {
  kind: "procedural";
  processKey: string;
  version: number;
  steps: Array<{ order: number; instruction: string }>;
  scope?: string;
  preconditions?: string[];
  expectedOutcome?: string;
  validationStatus: "observed_once" | "repeated" | "user_approved" | "draft";
  summary: string;
};

export type ReflectiveContent = {
  kind: "reflective";
  derivationMethod: string;
  timeWindow: { from: string; to: string };
  baseMemoryIds: string[];
  patternSummary: string;
  summary: string;
};

export type StructuredMemoryContent =
  | EpisodicContent
  | SemanticContent
  | ProceduralContent
  | ReflectiveContent;

export type ExperienceRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  experienceType: ExperienceType;
  occurredAt: string;
  sourceType: MemorySourceType;
  sourceReference: SourceReference | null;
  actorType: ActorType;
  actorId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  context: string;
  payload: Record<string, unknown>;
  sensitivity: MemorySensitivity;
  consentScope: ConsentScope;
  idempotencyKey: string | null;
  correlationId: string | null;
  fingerprint: string;
  createdAt: string;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  memoryType: MemoryType;
  status: MemoryStatus;
  title: string;
  content: string;
  structuredContent: StructuredMemoryContent;
  sourceType: MemorySourceType;
  sourceReference: SourceReference | null;
  evidence: MemoryEvidence[];
  context: string;
  subjects: MemorySubject[];
  importance: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  weight: number;
  sensitivity: MemorySensitivity;
  retentionPolicy: RetentionPolicy;
  validFrom: string | null;
  validUntil: string | null;
  occurredAt: string;
  lastRecalledAt: string | null;
  recallCount: number;
  supersedesMemoryId: string | null;
  supersededByMemoryId: string | null;
  duplicateOfMemoryId: string | null;
  promotionStatus: MemoryPromotionStatus;
  experienceId: string | null;
  idempotencyKey: string | null;
  fingerprint: string;
  semanticKey: string | null;
  scoreHistory: ScoreHistoryEntry[];
  consentScope: ConsentScope;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
};

export type MemoryFeedback = {
  id: string;
  userId: string;
  memoryId: string;
  kind: MemoryFeedbackKind;
  note: string | null;
  correctionContent: string | null;
  createdAt: string;
};

export type MemoryPromotionResult = {
  decision: PromotionDecision;
  reason: string;
  confidence: number;
  promotionConfidence: number;
  gates: Array<{ name: string; passed: boolean; detail: string }>;
  target: {
    category?: string;
    key?: string;
    value?: unknown;
    label?: string;
    existingClaimHint?: string | null;
  } | null;
  requiresUserConfirmation: boolean;
  memoryId: string;
};

export type MemoryAuditAction =
  | "experience_recorded"
  | "create"
  | "confirm"
  | "dispute"
  | "correct"
  | "archive"
  | "delete"
  | "forget"
  | "feedback"
  | "dedupe"
  | "supersede"
  | "expire"
  | "promote_evaluate"
  | "promote_apply"
  | "bootstrap"
  | "recall"
  | "status_transition";

export type MemoryAuditEvent = {
  id: string;
  userId: string;
  workspaceId: string | null;
  memoryId: string | null;
  experienceId: string | null;
  action: MemoryAuditAction;
  previousState: Record<string, unknown> | null;
  nextState: Record<string, unknown> | null;
  sourceType: MemorySourceType | null;
  reason: string;
  correlationId: string | null;
  createdAt: string;
};

export type RecordExperienceInput = {
  experienceType: ExperienceType;
  occurredAt?: string;
  sourceType: MemorySourceType;
  sourceReference?: SourceReference | null;
  actorType?: ActorType;
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  context?: string;
  payload?: Record<string, unknown>;
  sensitivity?: MemorySensitivity;
  consentScope?: ConsentScope;
  idempotencyKey?: string | null;
  correlationId?: string | null;
  workspaceId?: string | null;
  /** When true, also materialize a memory from the experience */
  materializeMemory?: boolean;
  memoryHint?: CreateMemoryInput;
};

export type CreateMemoryInput = {
  memoryType: MemoryType;
  title: string;
  content: string;
  structuredContent: StructuredMemoryContent;
  sourceType: MemorySourceType;
  sourceReference?: SourceReference | null;
  context?: string;
  subjects?: MemorySubject[];
  importance?: number;
  confidence?: number;
  weight?: number;
  sensitivity?: MemorySensitivity;
  retentionPolicy?: RetentionPolicy;
  validFrom?: string | null;
  validUntil?: string | null;
  occurredAt?: string;
  workspaceId?: string | null;
  experienceId?: string | null;
  idempotencyKey?: string | null;
  semanticKey?: string | null;
  consentScope?: ConsentScope;
  confirmNow?: boolean;
  metadata?: Record<string, unknown>;
  evidenceSummary?: string;
};

export type CorrectMemoryInput = {
  memoryId: string;
  title?: string;
  content?: string;
  structuredContent?: StructuredMemoryContent;
  reason: string;
};

export type SubmitMemoryFeedbackInput = {
  memoryId: string;
  kind: MemoryFeedbackKind;
  note?: string | null;
  correctionContent?: string | null;
};

export type MemorySearchFilters = {
  memoryType?: MemoryType | MemoryType[];
  status?: MemoryStatus | MemoryStatus[];
  context?: string;
  sourceType?: MemorySourceType;
  subjectType?: string;
  subjectId?: string;
  workspaceId?: string | null;
  query?: string;
  from?: string;
  to?: string;
  minConfidence?: number;
  minImportance?: number;
  promotionStatus?: MemoryPromotionStatus;
  includeDeleted?: boolean;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string | null;
};

export type MemoryTimelineEntry = {
  memory: MemoryRecord;
  explanation: string;
  relatedIds: string[];
};

export type MemoryBrainContext = {
  memories: Array<{
    id: string;
    memoryType: MemoryType;
    title: string;
    content: string;
    status: MemoryStatus;
    confidence: number;
    confidenceBand: ConfidenceBand;
    importance: number;
    sourceType: MemorySourceType;
    isFact: boolean;
    isHypothesis: boolean;
    context: string;
  }>;
  meta: {
    generatedAt: string;
    count: number;
    excludedRejected: number;
    excludedDeleted: number;
  };
  executionInfluence: "none";
};

export const ACTIVE_MEMORY_STATUSES: MemoryStatus[] = [
  "ACTIVE",
  "PENDING_REVIEW",
  "CONFIRMED",
  "DISPUTED",
  "OUTDATED",
];

export const BLOCKED_FROM_RECALL: MemoryStatus[] = [
  "REJECTED",
  "DELETED",
  "ARCHIVED",
  "SUPERSEDED",
  "CORRECTED",
];

/** Isolated browse/search never becomes identity/goal. */
export const ISOLATED_INTERACTION_SOURCES: MemorySourceType[] = [
  "search_or_browse",
  "discovery_engine",
  "conversation",
  "system_observation",
];
