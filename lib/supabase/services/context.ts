import { getUser, requireUser } from "@/lib/auth";
import {
  buildResolvedUserContext,
  type ResolvedUserContext,
} from "@/lib/context/resolved-user-context";
import { createClient } from "@/lib/supabase/server";
import type { AuraActiveContext, Workspace, WorkspaceMember, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type AuraAuditContext = {
  user: User;
  supabase: SupabaseClient<Database>;
  userId: string;
  /** Validated active workspace when context is workspace; otherwise null. */
  activeWorkspaceId: string | null;
  activeContext: AuraActiveContext;
  workspaceRole: WorkspaceRole | null;
  /** Immutable multiuser isolation context (actor = subject by default). */
  resolved: ResolvedUserContext;
};

declare global {
  var __AURA_AUDIT_CTX__: AuraAuditContext | undefined;
}

type MembershipRow = WorkspaceMember & {
  workspaces: Pick<Workspace, "id" | "name" | "slug"> | null;
};

async function loadWorkspaceContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{
  activeWorkspaceId: string | null;
  activeContext: AuraActiveContext;
  workspaceRole: WorkspaceRole | null;
}> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_workspace_id, active_context")
    .eq("id", userId)
    .maybeSingle();

  const activeContext: AuraActiveContext =
    profile?.active_context === "workspace" ? "workspace" : "personal";

  const requestedWorkspaceId = profile?.active_workspace_id ?? null;

  if (!requestedWorkspaceId || activeContext !== "workspace") {
    return {
      activeWorkspaceId: null,
      activeContext: "personal",
      workspaceRole: null,
    };
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", requestedWorkspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    // Stale profile selection — fall back to personal (do not trust browser)
    console.warn("[workspace] active_workspace_id sem membership ativa; negando acesso", {
      userId,
      requestedWorkspaceId,
    });
    // Soft-heal profile so dashboard doesn't keep a broken context
    await supabase
      .from("profiles")
      .update({
        active_workspace_id: null,
        active_context: "personal",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    return {
      activeWorkspaceId: null,
      activeContext: "personal",
      workspaceRole: null,
    };
  }

  return {
    activeWorkspaceId: requestedWorkspaceId,
    activeContext: "workspace",
    workspaceRole: membership.role as WorkspaceRole,
  };
}

export async function getDataContext(): Promise<AuraAuditContext> {
  const user = await requireUser();
  const supabase = await createClient();
  const ws = await loadWorkspaceContext(supabase, user.id);
  const resolved = buildResolvedUserContext({
    actorUserId: user.id,
    workspaceId: ws.activeWorkspaceId,
    contextType: ws.activeContext === "workspace" ? "workspace" : "personal",
    role: ws.workspaceRole,
  });
  return { user, supabase, userId: user.id, ...ws, resolved };
}

export async function getOptionalDataContext(): Promise<AuraAuditContext | null> {
  if (globalThis.__AURA_AUDIT_CTX__) {
    const g = globalThis.__AURA_AUDIT_CTX__;
    if (g.resolved) return g;
    // Certification/audit scripts may inject a partial ctx — normalize isolation fields.
    return {
      ...g,
      activeWorkspaceId: g.activeWorkspaceId ?? null,
      activeContext: g.activeContext ?? "personal",
      workspaceRole: g.workspaceRole ?? null,
      resolved: buildResolvedUserContext({
        actorUserId: g.userId,
        workspaceId: g.activeWorkspaceId ?? null,
        contextType: g.activeContext === "workspace" ? "workspace" : "personal",
        role: g.workspaceRole ?? null,
      }),
    };
  }

  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const ws = await loadWorkspaceContext(supabase, user.id);
  const resolved = buildResolvedUserContext({
    actorUserId: user.id,
    workspaceId: ws.activeWorkspaceId,
    contextType: ws.activeContext === "workspace" ? "workspace" : "personal",
    role: ws.workspaceRole,
  });
  return { user, supabase, userId: user.id, ...ws, resolved };
}

/**
 * Requires an active workspace membership. Use for Alvesz / shared data.
 * Never accepts a raw workspace_id from the client without membership check.
 */
export async function requireWorkspaceContext(
  explicitWorkspaceId?: string | null
): Promise<AuraAuditContext & { activeWorkspaceId: string; workspaceRole: WorkspaceRole }> {
  const ctx = await getDataContext();
  let targetId = explicitWorkspaceId ?? ctx.activeWorkspaceId;

  if (!targetId) {
    const memberships = await listUserMemberships(ctx);
    const rows = memberships.data ?? [];
    const alvesz = rows.find((m) => m.workspaces?.slug === "alvesz");
    targetId = alvesz?.workspace_id ?? rows[0]?.workspace_id ?? null;
  }

  if (!targetId) {
    throw new Error("workspace_required");
  }

  const { data: membership } = await ctx.supabase
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", targetId)
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    console.warn("[workspace] requireWorkspaceContext negado", {
      userId: ctx.userId,
      targetId,
    });
    throw new Error("workspace_access_denied");
  }

  return {
    ...ctx,
    activeWorkspaceId: targetId,
    activeContext: "workspace",
    workspaceRole: membership.role as WorkspaceRole,
    resolved: buildResolvedUserContext({
      actorUserId: ctx.userId,
      workspaceId: targetId,
      contextType: "workspace",
      role: membership.role as WorkspaceRole,
      correlationId: ctx.resolved.correlationId,
    }),
  };
}

export async function listUserMemberships(ctx: AuraAuditContext) {
  const { data: members, error } = await ctx.supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  const workspaceIds = [...new Set((members ?? []).map((m) => m.workspace_id))];
  const { data: workspaces } = workspaceIds.length
    ? await ctx.supabase
        .from("workspaces")
        .select("id, name, slug")
        .in("id", workspaceIds)
    : { data: [] as Pick<Workspace, "id" | "name" | "slug">[] };

  const byId = new Map((workspaces ?? []).map((w) => [w.id, w]));

  const data: MembershipRow[] = (members as WorkspaceMember[]).map((m) => ({
    ...m,
    workspaces: byId.get(m.workspace_id) ?? null,
  }));

  return { data, error: null };
}

export async function resolveUserDisplayName(
  ctx: NonNullable<Awaited<ReturnType<typeof getOptionalDataContext>>>
): Promise<string> {
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.userId)
    .maybeSingle();

  const fullName =
    profile?.full_name ??
    (ctx.user.user_metadata?.full_name as string | undefined) ??
    null;

  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    return first || trimmed;
  }
  const fromEmail = ctx.user.email?.split("@")[0]?.trim();
  return fromEmail || "você";
}
