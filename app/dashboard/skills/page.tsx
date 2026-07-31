import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { SkillCenterClient } from "@/components/dashboard/skills/skill-center-client";
import { getDataContext } from "@/lib/supabase/services/context";
import { createClient } from "@/lib/supabase/server";
import { ALVESZ_WORKSPACE_SLUG } from "@/lib/workspace/constants";

export default async function SkillsPage() {
  let userId = "local";
  let workspaceId: string | null = null;
  let workspaceSlug: string | null = null;
  let role: "owner" | "admin" | "member" | "viewer" = "owner";
  let isWorkspaceMember = false;

  try {
    const ctx = await getDataContext();
    userId = ctx.userId;
    workspaceId = ctx.activeWorkspaceId;
    role = ctx.workspaceRole ?? "owner";
    isWorkspaceMember = Boolean(ctx.activeWorkspaceId && ctx.workspaceRole);
    if (workspaceId) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("workspaces")
        .select("slug")
        .eq("id", workspaceId)
        .maybeSingle();
      workspaceSlug = data?.slug ?? null;
      if (workspaceSlug === ALVESZ_WORKSPACE_SLUG) {
        workspaceSlug = ALVESZ_WORKSPACE_SLUG;
      }
    }
  } catch {
    // local fallback
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Skills" },
        ]}
      />
      <SkillCenterClient
        userId={userId}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        role={role}
        isWorkspaceMember={isWorkspaceMember}
      />
    </div>
  );
}
