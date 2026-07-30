/**
 * Official Aura Brain table row types derived from applied migrations:
 * - 20260728200000_identity_engine_v1.sql
 * - 20260728210000_memory_engine_v1.sql
 * - 20260728220000_world_model_v1.sql
 * - 20260728230000_cognitive_engine_v1.sql
 * - 20260729120000_discovery_engine_v1.sql
 * - 20260729140000_rc2_1_collaborative_go_live.sql
 *
 * After applying migrations in Supabase, regenerate with:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> --schema public > types/database.generated.ts
 * then merge Brain tables into types/database.ts (see docs/operations/rc2-go-live-checklist.md).
 *
 * These types mirror migration columns exactly — not invented stubs.
 */

export type AuraBrainJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: AuraBrainJson | undefined }
  | AuraBrainJson[];

export type AuraBrainVisibilityScope =
  | "PRIVATE"
  | "WORKSPACE"
  | "SHARED_WITH_SELECTED_MEMBERS"
  | "SYSTEM_INTERNAL";

export type AuraIdentityClaimRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  category: string;
  key: string;
  value: AuraBrainJson;
  value_type: string;
  label: string;
  description: string;
  status: string;
  confidence: number;
  weight: number;
  context_scope: string;
  source_type: string;
  source_reference: AuraBrainJson | null;
  evidence: AuraBrainJson;
  confidence_history: AuraBrainJson;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  valid_from: string | null;
  valid_until: string | null;
  last_observed_at: string | null;
  sensitivity: string;
  conflict_group_id: string | null;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AuraIdentityAuditRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  action: string;
  claim_id: string | null;
  actor: string;
  previous_status: string | null;
  new_status: string | null;
  justification: string;
  correlation_id: string | null;
  metadata: AuraBrainJson;
  created_at: string;
};

export type AuraExperienceRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  experience_type: string;
  occurred_at: string;
  source_type: string;
  source_reference: AuraBrainJson | null;
  actor_type: string;
  actor_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  context: string;
  payload: AuraBrainJson;
  sensitivity: string;
  consent_scope: string;
  visibility_scope: AuraBrainVisibilityScope;
  idempotency_key: string | null;
  correlation_id: string | null;
  fingerprint: string;
  created_at: string;
};

export type AuraMemoryRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  memory_type: string;
  status: string;
  title: string;
  content: string;
  structured_content: AuraBrainJson;
  source_type: string;
  source_reference: AuraBrainJson | null;
  evidence: AuraBrainJson;
  context: string;
  subjects: AuraBrainJson;
  importance: number;
  confidence: number;
  weight: number;
  sensitivity: string;
  retention_policy: string;
  valid_from: string | null;
  valid_until: string | null;
  occurred_at: string;
  last_recalled_at: string | null;
  recall_count: number;
  supersedes_memory_id: string | null;
  superseded_by_memory_id: string | null;
  duplicate_of_memory_id: string | null;
  promotion_status: string;
  experience_id: string | null;
  idempotency_key: string | null;
  fingerprint: string;
  semantic_key: string | null;
  score_history: AuraBrainJson;
  consent_scope: string;
  visibility_scope: AuraBrainVisibilityScope;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type AuraWorldEntityRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  entity_type: string;
  canonical_key: string;
  display_name: string;
  description: string;
  status: string;
  confidence: number;
  importance: number;
  sensitivity: string;
  visibility_scope: AuraBrainVisibilityScope;
  context: string;
  attributes: AuraBrainJson;
  source_type: string;
  source_reference: AuraBrainJson | null;
  external_reference: string | null;
  aliases: AuraBrainJson;
  valid_from: string | null;
  valid_until: string | null;
  first_observed_at: string;
  last_observed_at: string;
  merged_into_id: string | null;
  score_history: AuraBrainJson;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type AuraWorldRelationshipRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string;
  direction: string;
  status: string;
  confidence: number;
  weight: number;
  importance: number;
  context: string;
  source_type: string;
  visibility_scope: AuraBrainVisibilityScope;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type AuraCognitiveArtifactRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  artifact_type: string;
  category: string;
  status: string;
  title: string;
  summary: string;
  structured_content: AuraBrainJson;
  confidence: number;
  importance: number;
  sensitivity: string;
  visibility_scope: AuraBrainVisibilityScope;
  method: string;
  method_version: string;
  fingerprint: string;
  evidence_set_hash: string;
  suppression_key: string | null;
  time_range: AuraBrainJson;
  valid_from: string | null;
  valid_until: string | null;
  first_generated_at: string;
  last_validated_at: string | null;
  supersedes_artifact_id: string | null;
  superseded_by_artifact_id: string | null;
  generated_by: string;
  provider_metadata: AuraBrainJson | null;
  execution_influence: "none";
  subject_references: AuraBrainJson;
  entity_references: AuraBrainJson;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type AuraDiscoveryArtifactRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  discovery_type: string;
  status: string;
  title: string;
  summary: string;
  confidence: number;
  impact: string;
  urgency: string;
  reversibility: string;
  fingerprint: string;
  evidence_set_hash: string;
  suppression_key: string | null;
  detector_id: string;
  method: string;
  method_version: string;
  origin: string;
  sensitivity: string;
  visibility_scope: AuraBrainVisibilityScope;
  execution_influence: "none";
  row_version: number;
  first_generated_at: string;
  last_validated_at: string | null;
  payload: AuraBrainJson;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type AuraDiscoveryFeedbackRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  artifact_id: string;
  kind: string;
  note: string | null;
  visibility_scope: AuraBrainVisibilityScope;
  created_at: string;
};

export type AuraDiscoverySuppressionRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  artifact_type: string;
  semantic_key: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
  broken_at: string | null;
  break_reason: string | null;
  visibility_scope: AuraBrainVisibilityScope;
};

export type AuraDiscoveryRunRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  correlation_id: string;
  status: string;
  artifacts_generated: number;
  suppressed_count: number;
  reused_count: number;
  duration_ms: number;
  dry_run: boolean;
  report: AuraBrainJson;
  created_at: string;
  completed_at: string | null;
};

export type AuraDiscoveryAuditRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  action: string;
  artifact_id: string | null;
  actor: string;
  previous_status: string | null;
  new_status: string | null;
  justification: string;
  correlation_id: string | null;
  metadata: AuraBrainJson;
  created_at: string;
};

/** Table names included in the Brain kernel for RC2.1 */
export const AURA_BRAIN_TABLE_NAMES = [
  "aura_identity_claims",
  "aura_identity_audit",
  "aura_experiences",
  "aura_memories",
  "aura_world_entities",
  "aura_world_relationships",
  "aura_cognitive_artifacts",
  "aura_discovery_artifacts",
  "aura_discovery_feedback",
  "aura_discovery_suppressions",
  "aura_discovery_runs",
  "aura_discovery_audit",
] as const;

export type AuraBrainTableName = (typeof AURA_BRAIN_TABLE_NAMES)[number];

type BrainTableDef<Row> = {
  Row: Row;
  Insert: Partial<Row> & { id: string; user_id: string };
  Update: Partial<Row>;
  Relationships: [];
};

/** Merged into Database["public"]["Tables"] after migrations are applied. */
export type AuraBrainTables = {
  aura_identity_claims: BrainTableDef<AuraIdentityClaimRow>;
  aura_identity_audit: BrainTableDef<AuraIdentityAuditRow>;
  aura_experiences: BrainTableDef<AuraExperienceRow>;
  aura_memories: BrainTableDef<AuraMemoryRow>;
  aura_world_entities: BrainTableDef<AuraWorldEntityRow>;
  aura_world_relationships: BrainTableDef<AuraWorldRelationshipRow>;
  aura_cognitive_artifacts: BrainTableDef<AuraCognitiveArtifactRow>;
  aura_discovery_artifacts: BrainTableDef<AuraDiscoveryArtifactRow>;
  aura_discovery_feedback: BrainTableDef<AuraDiscoveryFeedbackRow>;
  aura_discovery_suppressions: BrainTableDef<AuraDiscoverySuppressionRow>;
  aura_discovery_runs: BrainTableDef<AuraDiscoveryRunRow>;
  aura_discovery_audit: BrainTableDef<AuraDiscoveryAuditRow>;
};
