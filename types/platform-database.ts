/**
 * Sprint 10.1 — Platform table row types mirroring migrations:
 * - 20260731320000_sprint10_0_saas_skills_platform.sql
 * - 20260731330000_sprint10_1_public_beta_readiness.sql
 *
 * After applying migrations, regenerate official types with:
 *   npx supabase gen types typescript --project-id <ID> --schema public > types/database.generated.ts
 * then merge into types/database.ts.
 *
 * These rows mirror migration columns — not invented stubs.
 */

export type PlatformJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: PlatformJson | undefined }
  | PlatformJson[];

export type AuraCapabilityInstallationRow = {
  id: string;
  capability_id: string;
  user_id: string;
  workspace_id: string | null;
  status: string;
  installed_version: string;
  enabled: boolean;
  config: PlatformJson;
  error_message: string | null;
  installed_at: string;
  enabled_at: string | null;
  disabled_at: string | null;
  updated_at: string;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraSkillInstallationRow = {
  id: string;
  skill_id: string;
  user_id: string;
  workspace_id: string | null;
  status: string;
  installed_version: string;
  enabled: boolean;
  config: PlatformJson;
  error_message: string | null;
  installed_at: string;
  enabled_at: string | null;
  disabled_at: string | null;
  updated_at: string;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraFeatureFlagRow = {
  id: string;
  key: string;
  scope: string;
  enabled: boolean;
  user_id: string | null;
  workspace_id: string | null;
  capability_id: string | null;
  environment: string | null;
  reason: string;
  updated_at: string;
  row_version: number;
};

export type AuraOnboardingProgressRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  step: number;
  completed: boolean;
  answers: PlatformJson;
  experience_mode: string;
  first_value_checklist: PlatformJson;
  updated_at: string;
  created_at: string;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraNavigationPrefsRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  order_ids: string[];
  hidden_ids: string[];
  favorite_ids: string[];
  last_route: string | null;
  updated_at: string;
  row_version: number;
};

export type AuraBetaAccessRow = {
  id: string;
  user_id: string;
  access_status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  invited_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  beta_cohort: string | null;
  admin_notes: string;
  updated_at: string;
  created_at: string;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraPrivacyPrefsRow = {
  id: string;
  user_id: string;
  learning_enabled: boolean;
  memory_promotion_enabled: boolean;
  external_providers_enabled: boolean;
  usage_analytics_enabled: boolean;
  analytics_essential?: boolean;
  analytics_product?: boolean;
  analytics_performance?: boolean;
  analytics_providers?: boolean;
  updated_at: string;
  row_version: number;
};

/** Sprint 10.2 — see migration 20260731340000_sprint10_2_private_beta_operations.sql */
export type AuraBetaInviteRow = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  token_hash: string;
  cohort: string;
  experience_mode_suggested: string | null;
  workspace_mode: string | null;
  expires_at: string;
  created_by: string;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraDeletionRequestRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  status: "REQUESTED" | "REVIEW" | "SCHEDULED" | "CANCELLED" | "COMPLETED";
  reason: string;
  impact_summary: PlatformJson;
  requested_at: string;
  review_until: string | null;
  completed_at: string | null;
  soft_deleted: boolean;
  row_version: number;
};

export type AuraPlatformObservabilityRow = {
  id: string;
  event: string;
  user_id: string | null;
  workspace_id: string | null;
  correlation_id: string;
  duration_ms: number | null;
  result: string;
  error_code: string | null;
  environment: string;
  module: string;
  metadata: PlatformJson;
  created_at: string;
};
