/**
 * Sprint 10.2 — Private Beta Operations public API.
 */

export * from "@/lib/beta-ops/types";
export {
  getBetaOpsState,
  setBetaOpsState,
  clearBetaOpsState,
  createEmptyBetaOpsState,
  pushOpsAudit,
} from "@/lib/beta-ops/store";
export {
  createCorrelationId,
  getRequestCorrelationId,
  setRequestCorrelationId,
  clearRequestCorrelationId,
  correlationIdFromHeaders,
  correlationHeaderName,
  formatCorrelationForSupport,
} from "@/lib/beta-ops/correlation";
export {
  hashInviteToken,
  generateInviteToken,
  createBetaInvitePure,
  createBetaInvite,
  acceptBetaInvitePure,
  acceptBetaInvite,
  revokeBetaInvitePure,
  expireStaleInvitesPure,
  listBetaInvites,
} from "@/lib/beta-ops/invites";
export {
  BETA_COHORTS,
  getCohort,
  listCohorts,
  assignUserCohort,
  getUserCohort,
  cohortIsNotAuthorization,
} from "@/lib/beta-ops/cohorts";
export {
  sanitizeFeedbackContext,
  createFeedbackPure,
  createFeedback,
  updateFeedbackStatusPure,
  updateFeedbackStatus,
  addFeedbackCommentPure,
  listFeedbackForUser,
  listAllFeedback,
  getFeedbackById,
} from "@/lib/beta-ops/feedback";
export {
  createReleasePure,
  createRelease,
  setReleaseStatusPure,
  setReleaseStatus,
  markReleaseReadPure,
  listReleasedChangelog,
  getCurrentReleaseVersion,
} from "@/lib/beta-ops/releases";
export {
  createAnnouncementPure,
  createAnnouncement,
  listVisibleAnnouncements,
  markAnnouncementReadPure,
  isAnnouncementInScope,
} from "@/lib/beta-ops/announcements";
export {
  anonymizeWorkspaceId,
  recordErrorOccurrencePure,
  recordErrorOccurrence,
  updateErrorGroupStatusPure,
  sanitizeErrorGroupForUi,
  listErrorGroups,
} from "@/lib/beta-ops/errors";
export {
  DEFAULT_ANALYTICS_CONSENT,
  getAnalyticsConsent,
  canRecordProductEvent,
  recordProductEventPure,
  recordProductEvent,
  aggregateUsageMetrics,
} from "@/lib/beta-ops/analytics";
export {
  recordSignupAt,
  recordOnboardingCompletedAt,
  recordFirstValuePure,
  recordFirstValue,
  getFirstValueForUser,
  averageTimeToFirstValueMs,
} from "@/lib/beta-ops/first-value";
export {
  createMaintenanceRulePure,
  createMaintenanceRule,
  deactivateMaintenancePure,
  resolveMaintenance,
} from "@/lib/beta-ops/maintenance";
export {
  buildSupportView,
  assertSupportViewHasNoPrivateContent,
  SUPPORT_FORBIDDEN_FIELDS,
} from "@/lib/beta-ops/support";
export {
  buildDiagnosticsSnapshot,
  sanitizeDiagnosticsForCopy,
  diagnosticsContainsSecrets,
} from "@/lib/beta-ops/diagnostics";
export {
  stablePercentBucket,
  upsertRolloutPure,
  upsertRollout,
  resolveRolloutPure,
  resolveRollout,
  rollbackRolloutPure,
} from "@/lib/beta-ops/rollout";
export {
  createOpsNotification,
  listOpsNotifications,
  markOpsNotificationRead,
} from "@/lib/beta-ops/notifications";
export {
  isExpectedSecurityBlock,
  buildProductHealthReport,
} from "@/lib/beta-ops/product-health";
export {
  ROLLBACK_PLAYBOOK,
  executeFlagRollback,
  executeReleaseRollback,
  executeSkillDisable,
  executeCapabilityDisable,
  documentRollbackAudit,
} from "@/lib/beta-ops/rollback";
export { buildAdminBetaDashboard } from "@/lib/beta-ops/admin-dashboard";
export {
  BETA_OPS_COMMAND_PATTERNS,
  handleBetaOpsCommand,
} from "@/lib/beta-ops/command-center";
