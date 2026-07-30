import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import {
  getDiscoveryContextForBrain,
  listDiscoveries,
} from "@/lib/supabase/services/discovery-engine.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";

/**
 * Daily Discovery summary for dashboard / Meu Dia.
 */
export async function DiscoveryDashboardSummary() {
  let brain;
  let memories: Array<{ id: string; title: string }> = [];
  let pending: Array<{ id: string; title: string }> = [];

  try {
    brain = await getDiscoveryContextForBrain({ limit: 5 });
    pending = (
      await listDiscoveries({
        statuses: ["PENDING_CONFIRMATION"],
        limit: 5,
      })
    ).map((d) => ({ id: d.id, title: d.title }));
    memories = (await listMemories({ limit: 5 })).map((m) => ({
      id: m.id,
      title: m.title,
    }));
  } catch {
    brain = null;
  }

  if (!brain) {
    return (
      <DashboardCard
        title="Discovery"
        status="empty"
        emptyTitle="Discovery indisponível"
        href="/dashboard/discovery"
        testId="discovery-dashboard-summary"
      />
    );
  }

  const recent = brain.recentTitles.slice(0, 4);

  return (
    <section className="space-y-3" data-testid="discovery-dashboard-summary">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Discovery
          </p>
          <p className="text-[12px] text-zinc-500">
            Sinais do dia · merecem atenção · execução nenhuma
          </p>
        </div>
        <Link
          href="/dashboard/discovery"
          className="text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          Abrir painel
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          title="Últimas descobertas"
          status={recent.length ? "ok" : "empty"}
          emptyTitle="Sem descobertas ainda"
          emptyDescription="Há indícios a explorar após registrar memórias e atualizar descobertas."
          href="/dashboard/discovery"
          testId="discovery-summary-recent"
        >
          <ul className="space-y-1 text-[12px]">
            {recent.map((t, i) => (
              <li key={`${t}-${i}`}>
                <Link
                  href="/dashboard/discovery"
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard
          title="Maior risco"
          status={brain.topRisk ? "ok" : "empty"}
          emptyTitle="Nenhum risco ativo"
          emptyDescription="Quando houver indícios de risco, eles aparecem aqui."
          href={
            brain.topRisk
              ? `/dashboard/discovery?id=${brain.topRisk.id}`
              : "/dashboard/discovery"
          }
          testId="discovery-summary-risk"
        >
          {brain.topRisk ? (
            <Link
              href={`/dashboard/discovery?id=${brain.topRisk.id}`}
              className="text-[12px] text-rose-300/90 hover:underline"
            >
              {brain.topRisk.title} ({brain.topRisk.confidence}%)
            </Link>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Maior oportunidade"
          status={brain.topOpportunity ? "ok" : "empty"}
          emptyTitle="Nenhuma oportunidade"
          emptyDescription="Oportunidades que podem valer uma revisão aparecem aqui."
          href={
            brain.topOpportunity
              ? `/dashboard/discovery?id=${brain.topOpportunity.id}`
              : "/dashboard/discovery"
          }
          testId="discovery-summary-opportunity"
        >
          {brain.topOpportunity ? (
            <Link
              href={`/dashboard/discovery?id=${brain.topOpportunity.id}`}
              className="text-[12px] text-emerald-300/90 hover:underline"
            >
              {brain.topOpportunity.title} ({brain.topOpportunity.confidence}%)
            </Link>
          ) : null}
        </DashboardCard>

        <DashboardCard
          title="Aguardando confirmação"
          status={pending.length ? "ok" : "empty"}
          emptyTitle="Nada pendente"
          emptyDescription="Descobertas aguardando confirmação aparecem aqui."
          href="/dashboard/discovery"
          testId="discovery-summary-pending"
        >
          <ul className="space-y-1 text-[12px]">
            {pending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/discovery?id=${p.id}`}
                  className="text-amber-300/90 hover:underline"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard
          title="Memórias recentes"
          status={memories.length ? "ok" : "empty"}
          emptyTitle="Sem memórias"
          emptyDescription="Registre uma memória para o Aura começar a identificar conexões."
          href="/dashboard/settings/memory"
          testId="discovery-summary-memories"
        >
          <ul className="space-y-1 text-[12px]">
            {memories.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/dashboard/settings/memory#${m.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </section>
  );
}
