import { AuraCentral } from "@/components/dashboard/aura-central";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { WorkspaceDashboard } from "@/components/dashboard/workspace-dashboard";
import { DashboardError } from "@/components/dashboard/dashboard-card";
import { getDataContext } from "@/lib/supabase/services/context";
import { resolveDashboardMode } from "@/lib/dashboard/context-dashboard";

export default async function DashboardPage() {
  const ctx = await getDataContext();
  const mode = resolveDashboardMode({
    activeContext: ctx.activeContext,
    activeWorkspaceId: ctx.activeWorkspaceId,
    hasActiveMembership: Boolean(ctx.activeWorkspaceId && ctx.workspaceRole),
  });

  try {
    if (mode === "workspace") {
      return (
        <div className="space-y-4">
          <WorkspaceDashboard />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <PersonalDashboard />
        <AuraCentral />
      </div>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao carregar dashboard.";
    // Soft-heal already runs in getDataContext; fall back to personal message
    if (message === "workspace_required" || message === "workspace_access_denied") {
      return (
        <div className="space-y-4">
          <DashboardError message="Workspace indisponível. Voltando ao contexto pessoal." />
          <PersonalDashboard />
          <AuraCentral />
        </div>
      );
    }
    return <DashboardError message={message} />;
  }
}
