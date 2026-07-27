import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuraActiveContext, Database } from "@/types/database";
import { isWorkspaceTable } from "@/lib/workspace/constants";

export type ClientAuraContext = {
  userId: string;
  activeContext: AuraActiveContext;
  activeWorkspaceId: string | null;
};

export async function loadClientAuraContext(
  supabase: SupabaseClient<Database>
): Promise<ClientAuraContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_context, active_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  const activeContext: AuraActiveContext =
    profile?.active_context === "workspace" ? "workspace" : "personal";
  const activeWorkspaceId = profile?.active_workspace_id ?? null;

  if (activeContext === "workspace" && activeWorkspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", activeWorkspaceId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return {
        userId: user.id,
        activeContext: "personal",
        activeWorkspaceId: null,
      };
    }
  }

  return {
    userId: user.id,
    activeContext:
      activeContext === "workspace" && activeWorkspaceId
        ? "workspace"
        : "personal",
    activeWorkspaceId:
      activeContext === "workspace" ? activeWorkspaceId : null,
  };
}

export function shouldLoadWorkspaceTable(
  table: string,
  ctx: ClientAuraContext | null
): boolean {
  if (!isWorkspaceTable(table)) return true;
  return Boolean(ctx && ctx.activeContext === "workspace" && ctx.activeWorkspaceId);
}
