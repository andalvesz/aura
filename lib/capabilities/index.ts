/**
 * Sprint 10.0 — SaaS & Skills Platform Foundation public API.
 */

export * from "@/lib/capabilities/types";
export {
  CAPABILITY_AUDIT_MATRIX,
  BUILTIN_CAPABILITIES,
  EXCLUDED_CAPABILITY_IDS,
} from "@/lib/capabilities/catalog";
export { BUILTIN_SKILLS } from "@/lib/capabilities/skills-catalog";
export {
  registerCapability,
  registerSkill,
  clearCapabilityRegistry,
  clearSkillRegistry,
  getCapability,
  getSkill,
  getSkillBySlug,
  listCapabilities,
  listSkills,
  listCoreCapabilities,
  listOptionalCapabilities,
  listPublicSkills,
  isCapabilityRegistered,
  isSkillRegistered,
  ensureBuiltinCapabilities,
  ensureBuiltinSkills,
  ensurePlatformRegistries,
  compareSemver,
} from "@/lib/capabilities/registry";
export {
  createEmptyPlatformState,
  getPlatformState,
  setPlatformState,
  clearPlatformState,
  findCapabilityInstallation,
  findSkillInstallation,
  pushAudit,
  sanitizeExportConfig,
  nowIso,
  newId,
} from "@/lib/capabilities/store";
export {
  resolveCapabilityDependencies,
  resolveSkillDependencies,
  validateCapabilityAccess,
  validateSkillAccess,
  roleSatisfies,
  canActivate,
} from "@/lib/capabilities/dependencies";
export {
  canInstallCapability,
  canMutateCapability,
  canUninstallCapability,
  canAccessAdminPlatform,
  getAdminAllowlistFromEnv,
  assertNotCoreUninstall,
} from "@/lib/capabilities/permissions";
export {
  installCapabilityPure,
  enableCapabilityPure,
  disableCapabilityPure,
  uninstallCapabilityPure,
  installSkillPure,
  enableSkillPure,
  disableSkillPure,
  uninstallSkillPure,
  previewSkillInstall,
} from "@/lib/capabilities/installation";
export {
  updateCapabilityConfigPure,
  updateSkillConfigPure,
  restoreDefaultCapabilityConfigPure,
} from "@/lib/capabilities/configuration";
export {
  validateConfigAgainstSchema,
  validateDeclaredVersion,
  validateExportSchema,
} from "@/lib/capabilities/validation";
export {
  resolveVersionState,
  deprecationWarning,
  isUsableLifecycle,
  noopLifecycleHooks,
} from "@/lib/capabilities/lifecycle";
export {
  isCapabilityEffectivelyEnabled,
  resolveCapabilities,
  resolveSkills,
  bootstrapCoreInstallations,
  skillCenterSections,
} from "@/lib/capabilities/resolver";
export {
  isFeatureEnabled,
  setFeatureFlagPure,
  rejectClientFlagOverride,
} from "@/lib/capabilities/feature-flags";
export {
  PLAN_CATALOG,
  resolveEntitlementPure,
  commercialLimitWouldBlock,
  assertEntitlementNotTampered,
} from "@/lib/capabilities/entitlements";
export { recordUsageEventPure, aggregateUsage } from "@/lib/capabilities/metering";
export {
  upsertWorkspaceBrandingPure,
  getWorkspaceBranding,
  primaryBrandLabel,
} from "@/lib/capabilities/branding";
export {
  SYSTEM_TEMPLATES,
  ensureSystemTemplates,
  listTemplates,
  installTemplatePure,
  createUserTemplatePure,
} from "@/lib/capabilities/templates";
export {
  EXPERIENCE_PRESETS,
  getExperiencePreset,
} from "@/lib/capabilities/experience-modes";
export {
  suggestFromOnboarding,
  completePersonalOnboardingPure,
  completeWorkspaceOnboardingPure,
  getOnboardingStatus,
} from "@/lib/capabilities/onboarding";
export {
  NAV_CAPABILITY_MAP,
  buildDynamicNavigation,
  setNavigationOrderPure,
  enabledModuleIds,
  capabilityIdForNavItem,
} from "@/lib/capabilities/navigation";
export {
  exportConfigurationPure,
  previewImportPure,
  importConfigurationPure,
} from "@/lib/capabilities/export-import";
export {
  buildAdminSnapshot,
  recordAdminActionPure,
} from "@/lib/capabilities/admin";
export { saasReadinessGaps } from "@/lib/capabilities/saas-readiness";
export {
  handlePlatformCommand,
  PLATFORM_COMMAND_PATTERNS,
} from "@/lib/capabilities/command-center";
export {
  filterHomeWidgetsByCapabilities,
  filterHomeWidgetIdsByCapabilities,
} from "@/lib/capabilities/home-widgets";
export {
  resolvePlatformPersistenceMode,
  isMemoryPlatformPersistence,
} from "@/lib/capabilities/persistence-mode";
export {
  checkPlatformRateLimit,
  clearPlatformRateLimits,
} from "@/lib/capabilities/rate-limit";
export {
  recordPlatformEvent,
  listPlatformEvents,
  clearPlatformObservability,
} from "@/lib/capabilities/observability";
export {
  ensureBetaActive,
  getBetaAccess,
  canAccessBeta,
  suspendBetaAccess,
  reactivateBetaAccess,
  inviteBetaUser,
  listBetaAccessAggregated,
  clearBetaAccessStore,
} from "@/lib/capabilities/beta-access";
export {
  buildPlatformHealth,
  sanitizeHealthForUi,
} from "@/lib/capabilities/health";
export {
  ONBOARDING_V2_STEPS,
  createOnboardingV2Progress,
  advanceOnboardingStepPure,
  completeOnboardingV2Pure,
  resumeOnboardingFromState,
  firstValueActions,
  markFirstValueItem,
  canGoToStep,
  EMPTY_FIRST_VALUE,
} from "@/lib/capabilities/onboarding-v2";
export {
  getPrivacyPrefs,
  updatePrivacyPrefs,
  exportAccountDataPure,
  requestAccountDeletionPure,
  listDeletionRequests,
  cancelDeletionRequest,
  clearPrivacyStores,
  DEFAULT_PRIVACY_PREFS,
} from "@/lib/capabilities/privacy";
export {
  BETA_FEATURE_FLAGS,
  ensureBetaFeatureFlags,
} from "@/lib/capabilities/beta-flags";
export type { OnboardingV2Progress, FirstValueChecklist } from "@/lib/capabilities/onboarding-v2";
export type { PrivacyPrefs, AccountExportBundle, DeletionRequest } from "@/lib/capabilities/privacy";
export type { HealthStatus, PlatformHealthReport } from "@/lib/capabilities/health";
export type { BetaAccessStatus, BetaAccessRecord } from "@/lib/capabilities/beta-access";
