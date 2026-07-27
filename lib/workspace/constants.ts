/** Workspace / multiuser V1 shared constants and helpers (no I/O). */

export const WORKSPACE_TABLES = [
  "clientes",
  "orcamentos",
  "estoque",
  "leads",
  "alvesz_eventos",
  "alvesz_propostas",
] as const;

export type WorkspaceTable = (typeof WORKSPACE_TABLES)[number];

export type WorkspaceRole = "owner" | "admin" | "member";
export type WorkspaceMemberStatus = "active" | "invited" | "suspended";
export type AuraActiveContext = "personal" | "workspace";

export const ALVESZ_WORKSPACE_SLUG = "alvesz";

export function isWorkspaceTable(table: string): table is WorkspaceTable {
  return (WORKSPACE_TABLES as readonly string[]).includes(table);
}

export function canManageMembers(role: WorkspaceRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteWorkspace(role: WorkspaceRole | null | undefined): boolean {
  return role === "owner";
}

export function canChangeRoles(role: WorkspaceRole | null | undefined): boolean {
  return role === "owner";
}

/** Admin cannot remove/demote owner; only owner manages owner role. */
export function canMutateMember(params: {
  actorRole: WorkspaceRole;
  targetRole: WorkspaceRole;
  targetUserId: string;
  actorUserId: string;
  action: "remove" | "change_role" | "suspend";
  nextRole?: WorkspaceRole;
}): boolean {
  const { actorRole, targetRole, targetUserId, actorUserId, action, nextRole } = params;

  if (targetUserId === actorUserId && action === "remove") return false;
  if (targetRole === "owner" && actorRole !== "owner") return false;
  if (action === "change_role" && nextRole === "owner" && actorRole !== "owner") return false;
  if (action === "change_role" && actorRole !== "owner") return false;
  if (action === "remove" || action === "suspend") {
    return actorRole === "owner" || (actorRole === "admin" && targetRole !== "owner");
  }
  return actorRole === "owner";
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
