/**
 * Identity Engine V1 — contracts.
 * ADR-002 · ADR-005 · ADR-007 · RFC-001 / RFC-002
 *
 * Claims are independent assertions about the user — not one blob JSON identity.
 * No user-specific hardcoding. No clinical/psychological labels.
 */

/** Extensible category strings — starter set, not a closed world. */
export type IdentityCategory =
  | "personal"
  | "communication"
  | "preference"
  | "skill"
  | "interest"
  | "value"
  | "role"
  | "goal"
  | "work_style"
  | "learning_style"
  | "routine"
  | "life_context"
  | "constraint"
  | "motivation"
  | "behavior_pattern"
  | (string & {});

/** Confidence lifecycle statuses (ADR-005 applied to identity). */
export type IdentityClaimStatus =
  | "UNKNOWN"
  | "OBSERVED"
  | "HYPOTHESIS"
  | "LIKELY"
  | "CONFIRMED"
  | "LEARNED"
  | "OUTDATED"
  | "ARCHIVED"
  | "REJECTED";

export type IdentityValueType =
  | "string"
  | "number"
  | "boolean"
  | "string_list"
  | "json";

export type IdentitySourceType =
  | "user_explicit"
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
  | "bootstrap_profile"
  | "bootstrap_settings"
  | "memory_engine";

export type IdentityContextScope =
  | "global"
  | "personal"
  | "professional"
  | "business"
  | "health"
  | "education"
  | "travel"
  | "relationship"
  | "workspace"
  | (string & {});

export type ConfidenceBand = "LOW" | "MEDIUM" | "HIGH";

export type IdentitySensitivity =
  | "PUBLIC_PREF"
  | "STANDARD"
  | "SENSITIVE"
  | "RESTRICTED";

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

export type IdentityEvidence = {
  id: string;
  observedAt: string;
  sourceType: IdentitySourceType;
  sourceReference: SourceReference | null;
  summary: string;
  strength: number; // 0–100 contribution hint
  metadata?: Record<string, unknown>;
};

export type ConfidenceHistoryEntry = {
  at: string;
  from: number;
  to: number;
  reason: string;
  actor: "user" | "system";
  previousStatus: IdentityClaimStatus;
  nextStatus: IdentityClaimStatus;
};

export type IdentityClaim = {
  id: string;
  userId: string;
  workspaceId: string | null;
  category: IdentityCategory;
  key: string;
  value: unknown;
  valueType: IdentityValueType;
  label: string;
  description: string;
  status: IdentityClaimStatus;
  confidence: number;
  confidenceBand: ConfidenceBand;
  weight: number;
  contextScope: IdentityContextScope;
  sourceType: IdentitySourceType;
  sourceReference: SourceReference | null;
  evidence: IdentityEvidence[];
  confidenceHistory: ConfidenceHistoryEntry[];
  confirmedBy: string | null;
  confirmedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  validFrom: string | null;
  validUntil: string | null;
  lastObservedAt: string | null;
  sensitivity: IdentitySensitivity;
  conflictGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
};

export type IdentityAuditAction =
  | "create"
  | "observe"
  | "confirm"
  | "reject"
  | "correct"
  | "archive"
  | "delete"
  | "bootstrap"
  | "conflict_marked"
  | "status_transition";

export type IdentityAuditEvent = {
  id: string;
  userId: string;
  workspaceId: string | null;
  claimId: string | null;
  action: IdentityAuditAction;
  previousState: Record<string, unknown> | null;
  nextState: Record<string, unknown> | null;
  sourceType: IdentitySourceType | null;
  reason: string;
  correlationId: string | null;
  createdAt: string;
};

export type IdentityConflict = {
  id: string;
  category: IdentityCategory;
  key: string;
  contextScope: IdentityContextScope;
  claimIds: string[];
  values: unknown[];
  explanation: string;
};

export type IdentityClaimView = {
  claim: IdentityClaim;
  explanation: string;
};

export type IdentityProfile = {
  userId: string;
  workspaceId: string | null;
  contextScope: IdentityContextScope | "all";
  confirmed: IdentityClaimView[];
  likely: IdentityClaimView[];
  hypotheses: IdentityClaimView[];
  conflicts: IdentityConflict[];
  outdated: IdentityClaimView[];
  /** Soft summary — never hides underlying claims */
  summary: {
    confirmedCount: number;
    likelyCount: number;
    hypothesisCount: number;
    conflictCount: number;
    preferenceHints: string[];
    roleHints: string[];
    constraintHints: string[];
    communicationTone: string | null;
  };
  meta: {
    generatedAt: string;
    activeClaimCount: number;
    excludedRejected: number;
    excludedArchived: number;
  };
};

export type CreateIdentityClaimInput = {
  category: IdentityCategory;
  key: string;
  value: unknown;
  valueType?: IdentityValueType;
  label: string;
  description?: string;
  contextScope?: IdentityContextScope;
  workspaceId?: string | null;
  sourceType: IdentitySourceType;
  sourceReference?: SourceReference | null;
  status?: IdentityClaimStatus;
  confidence?: number;
  weight?: number;
  sensitivity?: IdentitySensitivity;
  evidenceSummary?: string;
  metadata?: Record<string, unknown>;
  /** If true, mark as confirmed by user immediately */
  confirmNow?: boolean;
};

export type ObserveIdentityEvidenceInput = {
  category: IdentityCategory;
  key: string;
  value: unknown;
  valueType?: IdentityValueType;
  label: string;
  description?: string;
  contextScope?: IdentityContextScope;
  workspaceId?: string | null;
  sourceType: IdentitySourceType;
  sourceReference?: SourceReference | null;
  evidenceSummary: string;
  evidenceStrength?: number;
  sensitivity?: IdentitySensitivity;
  metadata?: Record<string, unknown>;
};

export type CorrectIdentityClaimInput = {
  claimId: string;
  value?: unknown;
  label?: string;
  description?: string;
  contextScope?: IdentityContextScope;
  reason: string;
};

export const ACTIVE_PROFILE_STATUSES: IdentityClaimStatus[] = [
  "OBSERVED",
  "HYPOTHESIS",
  "LIKELY",
  "CONFIRMED",
  "LEARNED",
  "OUTDATED",
];

export const EXCLUDED_FROM_PROFILE: IdentityClaimStatus[] = [
  "REJECTED",
  "ARCHIVED",
  "UNKNOWN",
];
