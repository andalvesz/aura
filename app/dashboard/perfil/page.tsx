import Link from "next/link";
import { getDataContext } from "@/lib/supabase/services/context";
import { listActivities } from "@/lib/supabase/services/daily-ops.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import { listDiscoveries } from "@/lib/supabase/services/discovery-engine.service";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { DashboardCard } from "@/components/dashboard/dashboard-card";

export default async function ProfilePage() {
  const ctx = await getDataContext();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name, email, avatar_url, active_context, active_workspace_id")
    .eq("id", ctx.userId)
    .maybeSingle();

  const activities = await listActivities(8);
  let memoriesCreated = 0;
  let discoveriesConfirmed = 0;
  try {
    memoriesCreated = (await listMemories({ limit: 100 })).length;
  } catch {
    /* ignore */
  }
  try {
    discoveriesConfirmed = (
      await listDiscoveries({ statuses: ["CONFIRMED"], limit: 100 })
    ).length;
  } catch {
    /* ignore */
  }

  const name = profile?.full_name?.trim() || profile?.email || "Usuário";

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="profile-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Perfil" },
        ]}
      />
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-lg text-zinc-300">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-medium text-zinc-100">{name}</h1>
          <p className="text-[12px] text-zinc-500">{profile?.email}</p>
          <p className="text-[11px] text-zinc-600">
            Contexto: {ctx.activeContext}
            {ctx.workspaceRole ? ` · ${ctx.workspaceRole}` : ""}
            {ctx.activeWorkspaceId ? " · workspace ativo" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardCard title="Memórias" status="ok" testId="profile-memories">
          <p className="text-2xl text-zinc-100">{memoriesCreated}</p>
        </DashboardCard>
        <DashboardCard
          title="Descobertas confirmadas"
          status="ok"
          testId="profile-discoveries"
        >
          <p className="text-2xl text-zinc-100">{discoveriesConfirmed}</p>
        </DashboardCard>
        <DashboardCard title="Atividades" status="ok" testId="profile-activity">
          <p className="text-2xl text-zinc-100">{activities.length}</p>
        </DashboardCard>
      </div>

      <DashboardCard
        title="Últimas atividades"
        status={activities.length ? "ok" : "empty"}
        emptyTitle="Sem atividades"
        emptyDescription="Capture memórias para gerar histórico."
      >
        <ul className="space-y-1 text-[12px]">
          {activities.map((a) => (
            <li key={a.id} className="text-zinc-400">
              {a.href ? (
                <Link href={a.href} className="hover:text-cyan-300">
                  {a.title}
                </Link>
              ) : (
                a.title
              )}
              <span className="ml-2 text-[10px] text-zinc-600">
                {new Date(a.createdAt).toLocaleString("pt-BR")}
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <div className="flex flex-wrap gap-2 text-[12px]">
        <Link
          href="/dashboard/settings/aura-brain"
          className="text-cyan-400 hover:underline"
        >
          Configurações do Brain
        </Link>
        <Link
          href="/dashboard/workspace"
          className="text-zinc-500 hover:text-zinc-300"
        >
          Workspace
        </Link>
      </div>
    </div>
  );
}
