import { requireUser } from "@/lib/auth";
import { isDevelopmentEnv } from "@/lib/dev/is-development";
import { createClient } from "@/lib/supabase/server";
import { getAuraContextState } from "@/lib/supabase/services/workspace.service";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const state = await getAuraContextState();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <DashboardShell
      email={state.email || user.email || ""}
      fullName={fullName}
      showResetTestData={isDevelopmentEnv()}
      activeContext={state.activeContext}
      activeWorkspaceId={state.activeWorkspaceId}
      workspaceRole={state.workspaceRole}
      workspaces={state.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
      }))}
    >
      {children}
    </DashboardShell>
  );
}
