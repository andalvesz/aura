/**
 * World Model V1 — contracts.
 * ADR-004 · ADR-004 Addendum · ADR-005 · ADR-007 · RFC-004
 *
 * Cognitive projection over domain data. Never silently mutates sources.
 * No user-specific hardcoding. executionInfluence: none.
 */

export type WorldEntityType =
  | "person"
  | "organization"
  | "business"
  | "workspace"
  | "mission"
  | "project"
  | "goal"
  | "task"
  | "event"
  | "document"
  | "contact"
  | "location"
  | "skill"
  | "language"
  | "resource"
  | "tool"
  | "habit"
  | "routine"
  | "topic"
  | "concept"
  | "procedure"
  | "product"
  | "service"
  | "client"
  | "supplier"
  | "account"
  | "category"
  | "memory"
  | "identity_claim"
  | (string & {});

export type WorldRelationshipType =
  | "SELF"
  | "OWNS"
  | "FOUNDER_OF"
  | "MEMBER_OF"
  | "WORKS_FOR"
  | "WORKS_ON"
  | "MANAGES"
  | "CREATED"
  | "PARTICIPATES_IN"
  | "HAS_GOAL"
  | "HAS_MISSION"
  | "HAS_SKILL"
  | "LEARNING"
  | "INTERESTED_IN"
  | "PREFERS"
  | "USES"
  | "DEPENDS_ON"
  | "BLOCKED_BY"
  | "CONTRIBUTES_TO"
  | "SUPPORTS"
  | "PART_OF"
  | "RELATED_TO"
  | "LOCATED_IN"
  | "SCHEDULED_FOR"
  | "PRODUCES"
  | "CONSUMES"
  | "GENERATES"
  | "SERVES"
  | "PROVIDED_BY"
  | "DOCUMENTS"
  | "DERIVED_FROM"
  | "EVIDENCED_BY"
  | "REPRESENTS"
  | "SUPERSEDES"
  | "CONTRADICTS"
  | "ASSOCIATED_WITH"
  | (string & {});

export type WorldEntityStatus =
  | "ACTIVE"
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "SUPERSEDED"
  | "OUTDATED"
  | "REJECTED"
  | "ARCHIVED"
  | "DELETED";

export type WorldRelationshipStatus =
  | "ACTIVE"
  | "HYPOTHESIS"
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "DISPUTED"
  | "REJECTED"
  | "SUPERSEDED"
  | "OUTDATED"
  | "ARCHIVED"
  | "DELETED";

export type WorldSensitivity =
  | "PUBLIC_PREF"
  | "STANDARD"
  | "SENSITIVE"
  | "RESTRICTED";

export type WorldSourceType =
  | "user_explicit"
  | "manual_entry"
  | "mission_engine"
  | "identity_engine"
  | "memory_engine"
  | "business"
  | "workspace"
  | "document"
  | "bootstrap"
  | "system_observation"
  | "discovery_engine"
  | "search_or_browse"
  | "calendar"
  | "imported_data"
  | (string & {});

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type WorldEvidence = {
  id: string;
  observedAt: string;
  sourceType: WorldSourceType;
  sourceReference: SourceReference | null;
  summary: string;
  strength: number;
  memoryId?: string | null;
  claimId?: string | null;
};

export type ScoreHistoryEntry = {
  at: string;
  field: "confidence" | "importance" | "weight" | "projectionConfidence";
  from: number;
  to: number;
  reason: string;
  actor: "user" | "system";
};

export type WorldEntity = {
  id: string;
  userId: string;
  workspaceId: string | null;
  entityType: WorldEntityType;
  canonicalKey: string;
  displayName: string;
  description: string;
  status: WorldEntityStatus;
  confidence: number;
  confidenceBand: ConfidenceBand;
  importance: number;
  sensitivity: WorldSensitivity;
  context: string;
  attributes: Record<string, unknown>;
  sourceType: WorldSourceType;
  sourceReference: SourceReference | null;
  externalReference: string | null;
  aliases: string[];
  validFrom: string | null;
  validUntil: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  mergedIntoId: string | null;
  scoreHistory: ScoreHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
};

export type WorldRelationship = {
  id: string;
  userId: string;
  workspaceId: string | null;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: WorldRelationshipType;
  direction: "forward" | "symmetric";
  status: WorldRelationshipStatus;
  confidence: number;
  confidenceBand: ConfidenceBand;
  weight: number;
  importance: number;
  context: string;
  sourceType: WorldSourceType;
  sourceReference: SourceReference | null;
  evidence: WorldEvidence[];
  projectionConfidence: number;
  validFrom: string | null;
  validUntil: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  supersedesRelationshipId: string | null;
  supersededByRelationshipId: string | null;
  scoreHistory: ScoreHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  metadata: Record<string, unknown>;
};

export type WorldSuppression = {
  id: string;
  userId: string;
  workspaceId: string | null;
  kind: "entity" | "relationship";
  sourceType: WorldSourceType;
  sourceReference: SourceReference;
  relationshipType: WorldRelationshipType | null;
  reason: string;
  createdAt: string;
};

export type WorldAuditAction =
  | "entity_created"
  | "entity_updated"
  | "entity_merged"
  | "entity_split"
  | "entity_archived"
  | "entity_deleted"
  | "entity_corrected"
  | "relationship_created"
  | "relationship_confirmed"
  | "relationship_corrected"
  | "relationship_rejected"
  | "relationship_superseded"
  | "relationship_archived"
  | "projection_created"
  | "projection_skipped"
  | "projection_suppressed"
  | "bootstrap_executed"
  | "reconcile";

export type WorldAuditEvent = {
  id: string;
  userId: string;
  workspaceId: string | null;
  entityId: string | null;
  relationshipId: string | null;
  action: WorldAuditAction;
  previousState: Record<string, unknown> | null;
  nextState: Record<string, unknown> | null;
  sourceType: WorldSourceType | null;
  reason: string;
  correlationId: string | null;
  createdAt: string;
};

export type CreateWorldEntityInput = {
  entityType: WorldEntityType;
  displayName: string;
  description?: string;
  canonicalKey?: string;
  workspaceId?: string | null;
  context?: string;
  attributes?: Record<string, unknown>;
  sourceType: WorldSourceType;
  sourceReference?: SourceReference | null;
  externalReference?: string | null;
  confidence?: number;
  importance?: number;
  sensitivity?: WorldSensitivity;
  status?: WorldEntityStatus;
  confirmNow?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateWorldRelationshipInput = {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: WorldRelationshipType;
  workspaceId?: string | null;
  context?: string;
  sourceType: WorldSourceType;
  sourceReference?: SourceReference | null;
  evidenceSummary?: string;
  confidence?: number;
  importance?: number;
  weight?: number;
  status?: WorldRelationshipStatus;
  confirmNow?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  metadata?: Record<string, unknown>;
};

export type WorldEntityFilters = {
  entityType?: WorldEntityType | WorldEntityType[];
  status?: WorldEntityStatus | WorldEntityStatus[];
  context?: string;
  workspaceId?: string | null;
  query?: string;
  minConfidence?: number;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  limit?: number;
  cursor?: string | null;
};

export type WorldNeighborFilters = {
  relationshipType?: WorldRelationshipType | WorldRelationshipType[];
  direction?: "outgoing" | "incoming" | "both";
  entityType?: WorldEntityType;
  status?: WorldRelationshipStatus | WorldRelationshipStatus[];
  context?: string;
  minConfidence?: number;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string | null;
};

export type WorldPath = {
  nodes: WorldEntity[];
  edges: WorldRelationship[];
  depth: number;
  explanation: string;
};

export type WorldBrainContext = {
  entities: Array<{
    id: string;
    entityType: WorldEntityType;
    displayName: string;
    status: WorldEntityStatus;
    confidence: number;
    sourceType: WorldSourceType;
    context: string;
  }>;
  relationships: Array<{
    id: string;
    relationshipType: WorldRelationshipType;
    sourceName: string;
    targetName: string;
    status: WorldRelationshipStatus;
    confidence: number;
    inferred: boolean;
  }>;
  shortPaths: Array<{ summary: string; depth: number }>;
  meta: {
    generatedAt: string;
    entityCount: number;
    relationshipCount: number;
  };
  executionInfluence: "none";
};

export type ProjectionReportItem = {
  kind: "entity" | "relationship";
  action: "created" | "updated" | "skipped" | "suppressed" | "dry_run";
  id: string | null;
  reason: string;
};

export type ProjectionReport = {
  dryRun: boolean;
  items: ProjectionReportItem[];
  created: number;
  updated: number;
  skipped: number;
  suppressed: number;
};

export const ACTIVE_ENTITY_STATUSES: WorldEntityStatus[] = [
  "ACTIVE",
  "PENDING_REVIEW",
  "CONFIRMED",
];

export const VALID_RELATIONSHIP_STATUSES: WorldRelationshipStatus[] = [
  "ACTIVE",
  "CONFIRMED",
];

export const ISOLATED_SOURCES: WorldSourceType[] = [
  "search_or_browse",
  "discovery_engine",
  "system_observation",
];
