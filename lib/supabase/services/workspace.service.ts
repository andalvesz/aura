import {
  ALVESZ_WORKSPACE_SLUG,
  canManageMembers,
  canMutateMember,
  normalizeInviteEmail,
  type WorkspaceRole,
} from "@/lib/workspace/constants";
import {
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from "@/lib/workspace/invite-token";
import type { WorkspaceInvite, WorkspaceMember } from "@/types/database";
import {
  getDataContext,
  listUserMemberships,
  requireWorkspaceContext,
} from "./context";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export async function getAuraContextState() {
  try {
    const ctx = await getDataContext();
    const memberships = await listUserMemberships(ctx);

    const workspaces: WorkspaceSummary[] = (memberships.data ?? [])
      .filter((m) => m.workspaces)
      .map((m) => ({
        id: m.workspaces!.id,
        name: m.workspaces!.name,
        slug: m.workspaces!.slug,
        role: m.role as WorkspaceRole,
      }));

    const alvesz = workspaces.find((w) => w.slug === ALVESZ_WORKSPACE_SLUG) ?? null;

    return {
      userId: ctx.userId,
      email: ctx.user.email ?? "",
      activeContext: ctx.activeContext,
      activeWorkspaceId: ctx.activeWorkspaceId,
      workspaceRole: ctx.workspaceRole,
      workspaces,
      alvesz,
      error: memberships.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[workspace] getAuraContextState fallback", message);
    const ctx = await getDataContext().catch(() => null);
    return {
      userId: ctx?.userId ?? "",
      email: ctx?.user.email ?? "",
      activeContext: "personal" as const,
      activeWorkspaceId: null,
      workspaceRole: null,
      workspaces: [] as WorkspaceSummary[],
      alvesz: null,
      error: message,
    };
  }
}

export async function setActiveContext(params: {
  context: "personal" | "workspace";
  workspaceId?: string | null;
}) {
  const ctx = await getDataContext();

  if (params.context === "personal") {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({
        active_context: "personal",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.userId);

    return { error: error?.message ?? null };
  }

  const workspaceId = params.workspaceId ?? ctx.activeWorkspaceId;
  if (!workspaceId) {
    return { error: "workspace_id_required" };
  }

  const { data: membership } = await ctx.supabase
    .from("workspace_members")
    .select("id, role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return { error: "workspace_access_denied" };
  }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({
      active_context: "workspace",
      active_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.userId);

  return { error: error?.message ?? null };
}

export async function listWorkspaceMembers(workspaceId?: string) {
  const ctx = await requireWorkspaceContext(workspaceId);

  const { data: members, error } = await ctx.supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", ctx.activeWorkspaceId)
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: error.message };

  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", userIds);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return {
    data: (members as WorkspaceMember[]).map((m) => ({
      ...m,
      profile: byId.get(m.user_id) ?? null,
    })),
    error: null,
    role: ctx.workspaceRole,
    workspaceId: ctx.activeWorkspaceId,
  };
}

export async function listWorkspaceInvites(workspaceId?: string) {
  const ctx = await requireWorkspaceContext(workspaceId);
  if (!canManageMembers(ctx.workspaceRole)) {
    return { data: null, error: "forbidden" };
  }

  const { data, error } = await ctx.supabase
    .from("workspace_invites")
    .select("id, workspace_id, email, role, expires_at, accepted_at, invited_by, created_at")
    .eq("workspace_id", ctx.activeWorkspaceId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return {
    data: (data as Omit<WorkspaceInvite, "token_hash">[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function createWorkspaceInvite(params: {
  email: string;
  role?: "admin" | "member";
  workspaceId?: string;
  origin: string;
}) {
  const ctx = await requireWorkspaceContext(params.workspaceId);
  if (!canManageMembers(ctx.workspaceRole)) {
    return { data: null, error: "forbidden", inviteUrl: null };
  }

  const email = normalizeInviteEmail(params.email);
  if (!email || !email.includes("@")) {
    return { data: null, error: "invalid_email", inviteUrl: null };
  }

  const role = params.role === "admin" ? "admin" : "member";
  // Admin cannot invite as admin if we want stricter rules — V1: admin may invite member only
  if (ctx.workspaceRole === "admin" && role === "admin") {
    return { data: null, error: "admin_cannot_invite_admin", inviteUrl: null };
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expires = inviteExpiresAt(14).toISOString();

  const { data, error } = await ctx.supabase
    .from("workspace_invites")
    .insert({
      workspace_id: ctx.activeWorkspaceId,
      email,
      role,
      token_hash: tokenHash,
      expires_at: expires,
      invited_by: ctx.userId,
    })
    .select("id, workspace_id, email, role, expires_at, accepted_at, invited_by, created_at")
    .single();

  if (error) {
    return { data: null, error: error.message, inviteUrl: null };
  }

  return {
    data,
    error: null,
    inviteUrl: buildInviteUrl(params.origin, token),
  };
}

export async function cancelWorkspaceInvite(inviteId: string, workspaceId?: string) {
  const ctx = await requireWorkspaceContext(workspaceId);
  if (!canManageMembers(ctx.workspaceRole)) {
    return { error: "forbidden" };
  }

  const { error } = await ctx.supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId)
    .eq("workspace_id", ctx.activeWorkspaceId);

  return { error: error?.message ?? null };
}

export async function removeWorkspaceMember(memberId: string, workspaceId?: string) {
  const ctx = await requireWorkspaceContext(workspaceId);

  const { data: target } = await ctx.supabase
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .eq("workspace_id", ctx.activeWorkspaceId)
    .maybeSingle();

  if (!target) return { error: "member_not_found" };

  if (
    !canMutateMember({
      actorRole: ctx.workspaceRole,
      targetRole: target.role as WorkspaceRole,
      targetUserId: target.user_id,
      actorUserId: ctx.userId,
      action: "remove",
    })
  ) {
    return { error: "forbidden" };
  }

  const { error } = await ctx.supabase
    .from("workspace_members")
    .delete()
    .eq("id", memberId)
    .eq("workspace_id", ctx.activeWorkspaceId);

  return { error: error?.message ?? null };
}

export async function updateWorkspaceMemberRole(params: {
  memberId: string;
  role: WorkspaceRole;
  workspaceId?: string;
}) {
  const ctx = await requireWorkspaceContext(params.workspaceId);

  const { data: target } = await ctx.supabase
    .from("workspace_members")
    .select("*")
    .eq("id", params.memberId)
    .eq("workspace_id", ctx.activeWorkspaceId)
    .maybeSingle();

  if (!target) return { error: "member_not_found" };

  if (
    !canMutateMember({
      actorRole: ctx.workspaceRole,
      targetRole: target.role as WorkspaceRole,
      targetUserId: target.user_id,
      actorUserId: ctx.userId,
      action: "change_role",
      nextRole: params.role,
    })
  ) {
    return { error: "forbidden" };
  }

  const { error } = await ctx.supabase
    .from("workspace_members")
    .update({ role: params.role })
    .eq("id", params.memberId)
    .eq("workspace_id", ctx.activeWorkspaceId);

  return { error: error?.message ?? null };
}

export async function acceptWorkspaceInvite(rawToken: string) {
  const ctx = await getDataContext();
  const tokenHash = hashInviteToken(rawToken);

  const { data, error } = await ctx.supabase.rpc("accept_workspace_invite", {
    p_token_hash: tokenHash,
  });

  if (error) {
    return { workspaceId: null, error: error.message };
  }

  return { workspaceId: data as string, error: null };
}

export async function getWorkspaceBySlug(slug: string) {
  const ctx = await getDataContext();
  const { data, error } = await ctx.supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return { data, error: error?.message ?? null };
}
