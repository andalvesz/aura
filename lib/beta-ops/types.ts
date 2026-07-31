/**
 * Sprint 10.2 — Private Beta Operations types.
 * Cohorts are NOT authorization. Feature flags are NOT authorization.
 */

export type BetaInviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export type BetaCohortId =
  | "FOUNDERS"
  | "PERSONAL_USERS"
  | "CREATORS"
  | "BUSINESSES"
  | "TEAMS"
  | "CUSTOM";

export type FeedbackType =
  | "BUG"
  | "IDEA"
  | "CONFUSING"
  | "SLOW"
  | "MISSING_FEATURE"
  | "POSITIVE"
  | "OTHER";

export type FeedbackSeverity = "low" | "medium" | "high" | "critical";

export type FeedbackStatus =
  | "NEW"
  | "TRIAGED"
  | "PLANNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "WONT_FIX"
  | "DUPLICATE"
  | "ARCHIVED";

export type FeedbackTargetKind =
  | "page"
  | "module"
  | "skill"
  | "aura_response"
  | "recommendation"
  | "automation"
  | "agent"
  | "onboarding"
  | "general";

export type ReleaseChannel = "INTERNAL" | "BETA" | "STABLE";

export type ReleaseStatus = "DRAFT" | "READY" | "RELEASED" | "ROLLED_BACK" | "ARCHIVED";

export type AnnouncementKind =
  | "new_version"
  | "maintenance"
  | "known_issue"
  | "beta_feature"
  | "migration_pending"
  | "policy_change";

export type AnnouncementScope =
  | "global"
  | "cohort"
  | "workspace"
  | "user"
  | "capability";

export type ErrorGroupStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "MONITORING"
  | "RESOLVED"
  | "IGNORED";

export type FirstValueType =
  | "first_memory"
  | "first_project"
  | "first_conversation"
  | "first_mission"
  | "first_skill_installed"
  | "first_member_invited";

export type MaintenanceScope = "global" | "capability" | "route" | "workspace";

export type ProductEventName =
  | "daily_active"
  | "weekly_active"
  | "onboarding_completed"
  | "memory_created"
  | "project_created"
  | "conversation_started"
  | "skill_installed"
  | "discovery_reviewed"
  | "plan_created"
  | "automation_proposed"
  | "agent_started"
  | "invite_accepted"
  | "feedback_submitted"
  | "bug_reported"
  | "first_value"
  | "page_slow"
  | "upload_failed"
  | "provider_failed"
  | "automation_blocked"
  | "agent_failed"
  | "invite_failed"
  | "onboarding_abandoned"
  | "migration_missing"
  | "rls_denied_unexpected"
  | "session_error";

export type AnalyticsConsent = {
  essential: boolean; // always true — cannot disable security logs
  product: boolean;
  performance: boolean;
  providers: boolean;
};

export type BetaInvite = {
  id: string;
  email: string;
  status: BetaInviteStatus;
  tokenHash: string;
  cohort: BetaCohortId;
  experienceModeSuggested: string | null;
  workspaceMode: "personal" | "team" | "business" | null;
  expiresAt: string;
  createdBy: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  softDeleted: boolean;
};

export type BetaCohortConfig = {
  id: BetaCohortId;
  label: string;
  featureFlags: Record<string, boolean>;
  suggestedSkillIds: string[];
  onboardingVariant: string;
  technicalLimits: { maxSkills: number; maxAutomations: number; maxAgents: number };
  feedbackFormId: string;
  releaseChannel: ReleaseChannel;
};

export type FeedbackItem = {
  id: string;
  title: string;
  description: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  targetKind: FeedbackTargetKind;
  route: string | null;
  context: Record<string, unknown>;
  screenshotReference: string | null;
  browserMetadata: Record<string, string>;
  deviceMetadata: Record<string, string>;
  correlationId: string | null;
  status: FeedbackStatus;
  priority: number;
  assigneeId: string | null;
  linkedReleaseId: string | null;
  duplicateOfId: string | null;
  internalNotes: string;
  createdBy: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  softDeleted: boolean;
};

export type FeedbackComment = {
  id: string;
  feedbackId: string;
  authorId: string;
  body: string;
  internal: boolean;
  createdAt: string;
  softDeleted: boolean;
};

export type ReleaseRecord = {
  id: string;
  version: string;
  channel: ReleaseChannel;
  status: ReleaseStatus;
  title: string;
  summary: string;
  changes: Array<{ kind: "feature" | "fix" | "improvement" | "known_issue"; text: string }>;
  knownIssues: string[];
  migrationRequired: boolean;
  releasedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  softDeleted: boolean;
};

export type ReleaseRead = {
  id: string;
  releaseId: string;
  userId: string;
  readAt: string;
};

export type AnnouncementRecord = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  scope: AnnouncementScope;
  scopeId: string | null;
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  softDeleted: boolean;
};

export type AnnouncementRead = {
  id: string;
  announcementId: string;
  userId: string;
  readAt: string;
};

export type ErrorGroup = {
  id: string;
  code: string;
  route: string | null;
  version: string | null;
  environment: string;
  workspaceAnonId: string | null;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  status: ErrorGroupStatus;
  sampleMessage: string;
  softDeleted: boolean;
};

export type ProductEvent = {
  id: string;
  name: ProductEventName;
  userId: string | null;
  workspaceId: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FirstValueEvent = {
  id: string;
  userId: string;
  signupAt: string;
  onboardingCompletedAt: string | null;
  firstValueAt: string;
  firstValueType: FirstValueType;
  timeToFirstValueMs: number;
};

export type MaintenanceRule = {
  id: string;
  scope: MaintenanceScope;
  scopeKey: string | null;
  message: string;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  createdBy: string;
  createdAt: string;
  softDeleted: boolean;
};

export type PlatformAuditOps = {
  id: string;
  event: string;
  actorId: string | null;
  subjectType: string;
  subjectId: string;
  summary: string;
  metadata: Record<string, unknown>;
  correlationId: string | null;
  createdAt: string;
};

export type FeatureRollout = {
  id: string;
  key: string;
  percent: number; // 0–100
  cohorts: BetaCohortId[];
  userIds: string[];
  workspaceIds: string[];
  environment: string | null;
  enabled: boolean;
  reason: string;
  updatedAt: string;
  updatedBy: string;
};

export type OpsNotification = {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type SupportView = {
  userId: string;
  accountStatus: string;
  onboarding: { step: number; completed: boolean };
  capabilities: string[];
  skills: string[];
  featureFlags: Array<{ key: string; enabled: boolean }>;
  recentErrors: Array<{ code: string; correlationId: string; at: string }>;
  correlationIds: string[];
  migrations: string[];
  health: { ok: boolean };
  consents: AnalyticsConsent;
  /** Explicit: no private content fields */
  note: "support_mode_no_impersonation_no_private_content";
};
