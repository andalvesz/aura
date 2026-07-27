import { redirect } from "next/navigation";
import { WorkspaceSettingsClient } from "@/components/dashboard/workspace-settings-client";
import { canManageMembers } from "@/lib/workspace/constants";
import {
  getAuraContextState,
  listWorkspaceInvites,
  listWorkspaceMembers,
} from "@/lib/supabase/services/workspace.service";

export default async function WorkspaceSettingsPage() {
  const state = await getAuraContextState();
  const workspace =
    state.workspaces.find((w) => w.id === state.activeWorkspaceId) ??
    state.alvesz ??
    state.workspaces[0] ??
    null;

  if (!workspace) {
    redirect("/dashboard");
  }

  const membersResult = await listWorkspaceMembers(workspace.id);
  if (membersResult.error) {
    redirect("/dashboard");
  }

  const invitesResult = canManageMembers(membersResult.role)
    ? await listWorkspaceInvites(workspace.id)
    : { data: [], error: null };

  return (
    <WorkspaceSettingsClient
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      actorRole={membersResult.role!}
      members={membersResult.data ?? []}
      invites={invitesResult.data ?? []}
    />
  );
}
