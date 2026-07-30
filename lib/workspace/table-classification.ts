/**
 * Multiuser V1 table classification (security audit reference).
 * Keep in sync with WORKSPACE_TABLES and Expert Brain personal scope.
 */

import { WORKSPACE_TABLES, type WorkspaceTable } from "@/lib/workspace/constants";

export const SYSTEM_TABLES = [
  "profiles",
  "workspaces",
  "workspace_members",
  "workspace_invites",
] as const;

export const UNRESOLVED_TABLES = [
  "ad_sets",
  "ad_creatives",
  "funnel_steps",
  "market_benchmarks",
  "specialists",
] as const;

/** Explicit PERSONAL samples required by Multiusuário V1 audit. */
export const PERSONAL_AUDIT_SAMPLE = [
  "profiles", // own row only (also SYSTEM for peer select)
  "gastos",
  "financial_goals",
  "financial_income",
  "financial_balance",
  "goals",
  "eventos",
  "health_habits",
  "health_workouts",
  "health_meals",
  "dieta",
  "treinos",
  "ai_memories",
  "trips",
  "language_progress",
  "creator_products",
  "growth_leads",
  "growth_profiles",
  "expert_ingestion_queue",
  "expert_transcripts",
  "expert_frameworks",
  "expert_knowledge_sources",
  "expert_processing_queue",
] as const;

export const EXPERT_BRAIN_PERSONAL_TABLES = [
  "expert_knowledge_sources",
  "expert_frameworks",
  "expert_playbooks",
  "expert_patterns",
  "expert_decision_rules",
  "expert_checklists",
  "expert_failure_patterns",
  "expert_success_patterns",
  "expert_courses",
  "expert_course_modules",
  "expert_course_lessons",
  "expert_ingestion_queue",
  "expert_transcripts",
  "expert_processing_queue",
  "expert_influence_logs",
] as const;

export type TableScope = "PERSONAL" | "WORKSPACE" | "SYSTEM" | "UNRESOLVED";

export function classifyTable(table: string): TableScope {
  if ((WORKSPACE_TABLES as readonly string[]).includes(table)) return "WORKSPACE";
  if ((SYSTEM_TABLES as readonly string[]).includes(table)) return "SYSTEM";
  if ((UNRESOLVED_TABLES as readonly string[]).includes(table)) return "UNRESOLVED";
  return "PERSONAL";
}

export function isExpertBrainPersonalTable(table: string): boolean {
  return (EXPERT_BRAIN_PERSONAL_TABLES as readonly string[]).includes(table);
}

export function workspaceTables(): readonly WorkspaceTable[] {
  return WORKSPACE_TABLES;
}

/** Pure helpers used by tests to simulate IDOR / invite / context decisions. */
export function resolveEffectiveContext(params: {
  activeContext: "personal" | "workspace";
  activeWorkspaceId: string | null;
  hasActiveMembership: boolean;
}): { activeContext: "personal" | "workspace"; activeWorkspaceId: string | null } {
  if (
    params.activeContext === "workspace" &&
    params.activeWorkspaceId &&
    params.hasActiveMembership
  ) {
    return {
      activeContext: "workspace",
      activeWorkspaceId: params.activeWorkspaceId,
    };
  }
  return { activeContext: "personal", activeWorkspaceId: null };
}

export function canAccessWorkspaceRow(params: {
  actorWorkspaceId: string | null;
  rowWorkspaceId: string;
  isMember: boolean;
}): boolean {
  if (!params.actorWorkspaceId || !params.isMember) return false;
  return params.actorWorkspaceId === params.rowWorkspaceId;
}

export function canAccessPersonalRow(params: {
  actorUserId: string;
  rowUserId: string;
}): boolean {
  return params.actorUserId === params.rowUserId;
}

export type InviteAcceptScenario =
  | "valid"
  | "expired"
  | "already_used"
  | "email_mismatch"
  | "not_found";

export function evaluateInviteAccept(params: {
  inviteFound: boolean;
  acceptedAt: string | null;
  expiresAt: string;
  inviteEmail: string;
  userEmail: string;
  nowIso?: string;
}): InviteAcceptScenario {
  if (!params.inviteFound) return "not_found";
  if (params.acceptedAt) return "already_used";
  const now = params.nowIso ? new Date(params.nowIso) : new Date();
  if (new Date(params.expiresAt) < now) return "expired";
  if (params.inviteEmail.trim().toLowerCase() !== params.userEmail.trim().toLowerCase()) {
    return "email_mismatch";
  }
  return "valid";
}
