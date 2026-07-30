import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ActionButton } from "@/components/dashboard/action-button";
import { DiscoveryDashboardSummary } from "@/components/dashboard/discovery/discovery-dashboard-summary";
import { getWorkspaceDashboardSummary } from "@/lib/supabase/services/workspace-dashboard.service";
import { formatOptionalMetric } from "@/lib/dashboard/context-dashboard";
import { formatBRL } from "@/utils/format";

export async function WorkspaceDashboard() {
  const summary = await getWorkspaceDashboardSummary();
  const ops = summary.ops.data;
  const estimated = formatOptionalMetric(
    summary.commercial.data?.estimatedValue ?? null,
    formatBRL
  );

  return (
    <div className="space-y-4" data-testid="workspace-dashboard">
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Contexto workspace
        </p>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
          {ops?.workspaceName ?? "Workspace"}
        </h1>
        <p className="text-[13px] text-zinc-500">
          Role: {summary.role}
          {ops?.workspaceSlug ? ` · ${ops.workspaceSlug}` : ""} — dados isolados do
          pessoal.
        </p>
      </header>

      <QuickActions mode="workspace" role={summary.role} />

      <DiscoveryDashboardSummary />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DashboardCard
          title="Resumo da operação"
          status={summary.ops.status}
          error={summary.ops.error}
          emptyTitle="Workspace sem operação"
          emptyDescription="Cadastre clientes, leads ou eventos Alvesz."
          href="/dashboard/alvesz"
          className="md:col-span-2"
        >
          {ops ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <p>
                Clientes: {ops.activeClientes} · Propostas: {ops.openPropostas} ·
                Leads recentes: {ops.recentLeads.length}
              </p>
              {ops.upcomingEvents.length > 0 ? (
                <ul className="space-y-1">
                  {ops.upcomingEvents.map((e) => (
                    <li key={e.id}>
                      {e.data} — {e.titulo}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">Nenhum evento próximo.</p>
              )}
              {ops.alerts.map((a) => (
                <p
                  key={a}
                  className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-200"
                >
                  {a}
                </p>
              ))}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Comercial"
          status={summary.commercial.status}
          error={summary.commercial.error}
          emptyTitle="Sem orçamentos no Workspace"
          emptyDescription="Crie orçamentos Alvesz para acompanhar conversão."
          href="/dashboard/alvesz"
        >
          {summary.commercial.data ? (
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-zinc-500">Em aberto</dt>
                <dd className="text-zinc-100">
                  {summary.commercial.data.openPropostas}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Valor estimado</dt>
                <dd className="text-zinc-100">{estimated.display}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Fechados</dt>
                <dd className="text-zinc-100">
                  {summary.commercial.data.approvedCount}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Conversão</dt>
                <dd className="text-zinc-100">
                  {summary.commercial.data.conversionPct != null
                    ? `${summary.commercial.data.conversionPct}%`
                    : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-zinc-500">Receita registrada (fechados)</dt>
                <dd className="text-zinc-100">
                  {formatBRL(summary.commercial.data.registeredRevenue)}
                </dd>
              </div>
            </dl>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="CRM"
          status={summary.crm.status}
          error={summary.crm.error}
          emptyTitle="CRM vazio"
          emptyDescription="Adicione leads e clientes do Workspace."
          href="/dashboard/alvesz"
        >
          {summary.crm.data ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <p>
                Clientes: {summary.crm.data.clientesCount} · Follow-ups:{" "}
                {summary.crm.data.followUpsPending}
              </p>
              <ul className="space-y-1">
                {summary.crm.data.recentLeads.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span>{l.nome}</span>
                    <span className="text-zinc-500">{l.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Alvesz Experience"
          status={summary.alvesz.status}
          error={summary.alvesz.error}
          emptyTitle="Sem dados Alvesz"
          emptyDescription="Eventos, propostas e estoque aparecem aqui."
          href="/dashboard/alvesz"
        >
          {summary.alvesz.data ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <p>Propostas: {summary.alvesz.data.propostasCount}</p>
              {summary.alvesz.data.estoqueAlerts.length > 0 ? (
                <ul className="space-y-1 text-amber-200">
                  {summary.alvesz.data.estoqueAlerts.map((e) => (
                    <li key={e.id}>
                      Estoque baixo: {e.produto} ({e.quantidade})
                    </li>
                  ))}
                </ul>
              ) : null}
              {summary.alvesz.data.recentPdfs.length > 0 ? (
                <ul className="space-y-1">
                  {summary.alvesz.data.recentPdfs.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/api/alvesz-proposta-pdf/${p.id}`}
                        className="text-zinc-200 underline-offset-2 hover:underline"
                      >
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Conteúdo e Growth"
          status={summary.growth.status}
          error={summary.growth.error}
          emptyTitle="Growth é pessoal"
          emptyDescription={
            summary.growth.data?.note ??
            "Troque para o contexto Pessoal para conteúdos e Growth leads."
          }
          emptyAction={
            <Link href="/dashboard/crescimento">
              <ActionButton type="button">Abrir Growth</ActionButton>
            </Link>
          }
        />

        <DashboardCard
          title="Equipe"
          status={summary.team.status}
          error={summary.team.error}
          emptyTitle="Sem membros"
          emptyDescription="Convide pessoas pelo painel do Workspace."
          href="/dashboard/workspace"
        >
          {summary.team.data ? (
            <div className="space-y-2 text-[12px] text-zinc-300">
              <ul className="space-y-1">
                {summary.team.data.members.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-zinc-400">
                      {m.userId.slice(0, 8)}…
                    </span>
                    <span className="text-zinc-500">{m.role}</span>
                  </li>
                ))}
              </ul>
              {summary.team.data.canManage ? (
                <p className="text-zinc-500">
                  Convites pendentes: {summary.team.data.pendingInvites}
                </p>
              ) : (
                <p className="text-zinc-600">
                  Gestão de convites restrita a Owner/Admin.
                </p>
              )}
              {summary.team.data.canOwnerActions ? (
                <Link href="/dashboard/workspace">
                  <ActionButton type="button">Administrar Workspace</ActionButton>
                </Link>
              ) : null}
            </div>
          ) : null}
        </DashboardCard>
      </div>
    </div>
  );
}
