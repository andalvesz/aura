/**
 * Sprint 10.0 — SaaS & Skills Platform Foundation types.
 * Composes existing registries; does not replace cognitive kernel.
 */

export type CapabilityType =
  | "CORE"
  | "MODULE"
  | "SKILL"
  | "AGENT"
  | "AUTOMATION"
  | "TEMPLATE"
  | "INTEGRATION"
  | "VIEW"
  | "CONNECTOR";

export type CapabilityLifecycleStatus =
  | "DRAFT"
  | "BETA"
  | "STABLE"
  | "DEPRECATED"
  | "DISABLED"
  | "REMOVED";

export type CapabilityScope =
  | "SYSTEM"
  | "USER"
  | "WORKSPACE"
  | "PRIVATE_WORKSPACE";

export type InstallationStatus =
  | "available"
  | "installed"
  | "enabled"
  | "disabled"
  | "error"
  | "pending_dependencies"
  | "migration_required"
  | "incompatible"
  | "deprecated";

export type SkillVisibility =
  | "PRIVATE"
  | "WORKSPACE"
  | "SYSTEM"
  | "FUTURE_PUBLIC";

export type SkillAuthorType = "SYSTEM" | "USER" | "WORKSPACE" | "INTERNAL";

export type SkillRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type ExperienceMode =
  | "PERSONAL"
  | "CREATOR"
  | "BUSINESS"
  | "TEAM"
  | "CUSTOM";

export type EntitlementPlan = "FREE" | "PRO" | "BUSINESS" | "CUSTOM";

export type FeatureFlagScope =
  | "system"
  | "user"
  | "workspace"
  | "capability"
  | "environment";

export type PlatformAuditEvent =
  | "capability_installed"
  | "capability_enabled"
  | "capability_disabled"
  | "capability_uninstalled"
  | "skill_installed"
  | "skill_enabled"
  | "skill_disabled"
  | "skill_uninstalled"
  | "dependency_failed"
  | "config_updated"
  | "template_created"
  | "template_installed"
  | "feature_flag_updated"
  | "configuration_exported"
  | "configuration_imported"
  | "onboarding_completed"
  | "entitlement_resolved"
  | "admin_action";

export type UsageMetricKind =
  | "active_users"
  | "workspaces"
  | "storage_bytes"
  | "documents_processed"
  | "automation_executions"
  | "agent_sessions"
  | "provider_calls"
  | "messages"
  | "projects"
  | "skills_installed";

export type PlatformRole = "owner" | "admin" | "member" | "viewer" | "any";

export type CapabilityDependency = {
  capabilityId: string;
  minVersion?: string;
  optional?: boolean;
};

export type CapabilityLimits = {
  maxItems?: number;
  maxStorageMb?: number;
  ratePerHour?: number;
};

export type CapabilityNavItem = {
  id: string;
  href: string;
  label: string;
  section?: string;
  hideable?: boolean;
};

export type CapabilityVersionState = {
  installedVersion: string | null;
  availableVersion: string;
  migrationRequired: boolean;
  updateAvailable: boolean;
  incompatible: boolean;
  deprecated: boolean;
};

export type CapabilityDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  category: string;
  capabilityType: CapabilityType;
  status: CapabilityLifecycleStatus;
  scope: CapabilityScope;
  dependencies: CapabilityDependency[];
  conflicts: string[];
  requiredRoles: PlatformRole[];
  requiredPermissions: string[];
  requiredMigrations: string[];
  defaultEnabled: boolean;
  configSchema: Record<string, unknown>;
  routes: string[];
  navigationItems: CapabilityNavItem[];
  actions: string[];
  agents: string[];
  automations: string[];
  templates: string[];
  limits: CapabilityLimits;
  featureFlags: string[];
  /** Core cannot be uninstalled. */
  core: boolean;
  /** Private workspace pack (e.g. Alvesz) — not shown as generic module. */
  privateWorkspace?: boolean;
  allowedWorkspaceSlugs?: string[];
  replaces?: string[];
  deprecatedMessage?: string;
  moduleIds?: string[];
};

export type CapabilityInstallation = {
  id: string;
  capabilityId: string;
  userId: string;
  workspaceId: string | null;
  status: InstallationStatus;
  installedVersion: string;
  enabled: boolean;
  config: Record<string, unknown>;
  errorMessage: string | null;
  installedAt: string;
  enabledAt: string | null;
  disabledAt: string | null;
  updatedAt: string;
  softDeleted: boolean;
};

export type SkillDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  category: string;
  authorType: SkillAuthorType;
  authorId: string;
  visibility: SkillVisibility;
  status: CapabilityLifecycleStatus;
  capabilities: string[];
  requiredCapabilities: string[];
  permissions: string[];
  riskLevel: SkillRiskLevel;
  configSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  icon: string;
  documentation: string;
  privateWorkspace?: boolean;
  allowedWorkspaceSlugs?: string[];
  uninstallable: boolean;
};

export type SkillInstallation = {
  id: string;
  skillId: string;
  userId: string;
  workspaceId: string | null;
  status: InstallationStatus;
  installedVersion: string;
  enabled: boolean;
  config: Record<string, unknown>;
  errorMessage: string | null;
  installedAt: string;
  enabledAt: string | null;
  disabledAt: string | null;
  updatedAt: string;
  softDeleted: boolean;
};

export type FeatureFlag = {
  id: string;
  key: string;
  scope: FeatureFlagScope;
  enabled: boolean;
  userId: string | null;
  workspaceId: string | null;
  capabilityId: string | null;
  environment: string | null;
  reason: string;
  updatedAt: string;
};

export type TemplateKind =
  | "mission"
  | "project"
  | "plan"
  | "automation"
  | "agent"
  | "workspace"
  | "knowledge";

export type PlatformTemplate = {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  version: string;
  category: string;
  payload: Record<string, unknown>;
  requiredCapabilities: string[];
  system: boolean;
  status: CapabilityLifecycleStatus;
};

export type WorkspaceBranding = {
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  description: string | null;
  icon: string | null;
  updatedAt: string;
};

export type UsageEvent = {
  id: string;
  kind: UsageMetricKind;
  userId: string | null;
  workspaceId: string | null;
  value: number;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type EntitlementRecord = {
  id: string;
  userId: string;
  workspaceId: string | null;
  plan: EntitlementPlan;
  /** Commercial limits never applied in Sprint 10.0 — always full access. */
  fullAccess: boolean;
  features: string[];
  resolvedAt: string;
};

export type PlatformAuditEntry = {
  id: string;
  event: PlatformAuditEvent;
  userId: string;
  workspaceId: string | null;
  subjectType: string;
  subjectId: string;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DependencyIssueCode =
  | "missing_dependency"
  | "version_incompatible"
  | "conflict"
  | "capability_disabled"
  | "insufficient_role"
  | "wrong_workspace"
  | "migration_pending"
  | "invalid_config"
  | "core_protected"
  | "not_registered"
  | "private_skill_denied"
  | "viewer_forbidden"
  | "malicious_import"
  | "schema_invalid"
  | "version_forged";

export type DependencyIssue = {
  code: DependencyIssueCode;
  message: string;
  capabilityId?: string;
  skillId?: string;
};

export type ResolveContext = {
  userId: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  role: PlatformRole;
  isWorkspaceMember: boolean;
  environment?: string;
};

export type OnboardingAnswers = {
  primaryGoal: string;
  usageType: "personal" | "business" | "both";
  desiredAreas: string[];
  workspaceSize: "solo" | "small" | "medium" | "large";
  automationLevel: "low" | "medium" | "high";
  language: string;
  timezone: string;
};

export type WorkspaceOnboardingInput = {
  name: string;
  segment: string;
  memberEmails: string[];
  objectives: string[];
  moduleIds: string[];
  skillIds: string[];
  contextNotes: string;
  branding: Partial<Omit<WorkspaceBranding, "workspaceId" | "updatedAt">>;
};

export type ConfigExportBundle = {
  formatVersion: "aura-platform-config/v1";
  exportedAt: string;
  capabilities: Array<{
    capabilityId: string;
    enabled: boolean;
    version: string;
    config: Record<string, unknown>;
  }>;
  skills: Array<{
    skillId: string;
    enabled: boolean;
    version: string;
    config: Record<string, unknown>;
  }>;
  navigationOrder: string[];
  templates: string[];
  preferences: Record<string, unknown>;
  experienceMode: ExperienceMode;
};

export type PlatformState = {
  installations: CapabilityInstallation[];
  skillInstallations: SkillInstallation[];
  featureFlags: FeatureFlag[];
  templates: PlatformTemplate[];
  branding: WorkspaceBranding[];
  usageEvents: UsageEvent[];
  entitlements: EntitlementRecord[];
  audit: PlatformAuditEntry[];
  onboardingByUser: Record<
    string,
    { completed: boolean; answers: OnboardingAnswers | null; experienceMode: ExperienceMode }
  >;
  navigationOrderByUser: Record<string, string[]>;
};

export type CapabilityMatrixRow = {
  capability: string;
  core: boolean;
  optional: boolean;
  customizable: boolean;
  shareable: boolean;
  disableable: boolean;
};
