import Link from "next/link";
import {
  getHomeBusinessExpertCard,
  getHomeBusinessWidgets,
} from "@/lib/business-expert";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { getDataContext } from "@/lib/supabase/services/context";

export async function BusinessExpertHomeWidget() {
  let userId = "local";
  try {
    const ctx = await getDataContext();
    userId = ctx.userId;
  } catch {
    /* ignore */
  }

  const card = getHomeBusinessExpertCard(userId);
  const widgets = getHomeBusinessWidgets(userId);

  return (
    <section className="space-y-3" data-testid="home-business-expert-block">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-medium text-zinc-200">Business Expert</h2>
        <Link
          href={card.href}
          className="text-[11px] text-emerald-300 hover:underline"
        >
          Abrir →
        </Link>
      </div>
      <DashboardCard
        title={card.title}
        status="ok"
        href={card.href}
        testId="home-business-expert-card"
      >
        <p className="text-[12px] text-zinc-400">{card.subtitle}</p>
        <p className="mt-2 text-[12px] text-zinc-300">
          Perfil: {card.completeness}% · {card.nextAction}
        </p>
      </DashboardCard>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="home-business-widgets"
      >
        <DashboardCard
          title="Oportunidades"
          status={widgets.opportunities.length ? "ok" : "empty"}
          emptyTitle="Sem sinais"
          emptyDescription="Complete o perfil empresarial."
          href="/dashboard/business-expert"
          testId="home-be-opportunities"
        >
          <ul className="space-y-1 text-[12px] text-zinc-300">
            {widgets.opportunities.slice(0, 3).map((o) => (
              <li key={o.id}>{o.title}</li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Negócios"
          status={widgets.businesses.length ? "ok" : "empty"}
          emptyTitle="Nenhum negócio"
          emptyDescription="Registre ventures no Business Expert."
          href="/dashboard/business-expert"
          testId="home-be-businesses"
        >
          <ul className="space-y-1 text-[12px] text-zinc-300">
            {widgets.businesses.slice(0, 3).map((b) => (
              <li key={b.id}>
                {b.name} · {b.status}
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Mercados"
          status={widgets.markets.length ? "ok" : "empty"}
          emptyTitle="Sem áreas"
          emptyDescription="Marque interesses no perfil."
          href="/dashboard/business-expert"
          testId="home-be-markets"
        >
          <p className="text-[12px] text-zinc-300">
            {widgets.markets.join(" · ") || "—"}
          </p>
        </DashboardCard>
        <DashboardCard
          title="Ideias"
          status={widgets.ideas.length ? "ok" : "empty"}
          emptyTitle="Sem validações"
          emptyDescription="Use o Idea Validator."
          href="/dashboard/business-expert"
          testId="home-be-ideas"
        >
          <ul className="space-y-1 text-[12px] text-zinc-300">
            {widgets.ideas.slice(0, 3).map((i) => (
              <li key={i.id}>
                {i.idea.slice(0, 48)}… ({i.score})
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Projetos empresariais"
          status={widgets.projects.length ? "ok" : "empty"}
          emptyTitle="Sem projetos"
          emptyDescription="Gere um plano no Business Expert."
          href="/dashboard/plans"
          testId="home-be-projects"
        >
          <ul className="space-y-1 text-[12px] text-zinc-300">
            {widgets.projects.slice(0, 3).map((p, idx) => (
              <li key={`${p.name}-${idx}`}>{p.name}</li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </section>
  );
}
