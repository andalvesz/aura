import Link from "next/link";
import { MyDay } from "@/components/dashboard/my-day";
import { RecentActivityPanel } from "@/components/dashboard/daily/recent-activity-panel";
import { BrainNotificationsPanel } from "@/components/dashboard/daily/brain-notifications-panel";
import { SyncPanel } from "@/components/dashboard/smart-capture/sync-panel";
import {
  listFavorites,
  listInboxItems,
} from "@/lib/supabase/services/daily-ops.service";
import { listMemories } from "@/lib/supabase/services/memory-engine.service";
import { getAuraBrainTimeline } from "@/lib/supabase/services/discovery-engine.service";
import { getHomeProjectsWidget } from "@/lib/supabase/services/projects.service";
import { getHomeKnowledgeWidget } from "@/lib/supabase/services/knowledge-hub.service";
import { getHomeDecisionWidget } from "@/lib/supabase/services/decision-support.service";
import { getHomeScenarioWidget } from "@/lib/supabase/services/scenario.service";
import { getHomePriorityWidget } from "@/lib/supabase/services/prioritization.service";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { filterFavoritesByPin } from "@/lib/smart-capture/pins";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/types";

/**
 * Personal home — RC3–RC4.1 + Sprint 7.0/7.1/7.2 Decision, Scenario & Priority widgets.
 */
export async function PersonalDashboard() {
  let inboxCount = 0;
  let recentMemories: Array<{ id: string; title: string }> = [];
  let timeline: Array<{ id: string; title: string; at: string; href: string }> =
    [];
  let homePins: Array<{ id: string; title: string; href: string }> = [];
  let projectsWidget: Awaited<ReturnType<typeof getHomeProjectsWidget>> = {
    active: [],
    recent: [],
    favorites: [],
  };
  let knowledgeWidget: Awaited<ReturnType<typeof getHomeKnowledgeWidget>> = {
    recentDocuments: [],
    recentNotes: [],
    updatedKnowledge: [],
  };
  let decisionWidget: Awaited<ReturnType<typeof getHomeDecisionWidget>> = {
    priorities: [],
    inReview: [],
    insufficientData: [],
  };
  let scenarioWidget: Awaited<ReturnType<typeof getHomeScenarioWidget>> = {
    recent: [],
  };
  let priorityWidget: Awaited<ReturnType<typeof getHomePriorityWidget>> = {
    weekPriorities: [],
  };

  try {
    inboxCount = (await listInboxItems("all")).length;
  } catch {
    /* ignore */
  }
  try {
    recentMemories = (await listMemories({ limit: 5 })).map((m) => ({
      id: m.id,
      title: m.title,
    }));
  } catch {
    /* ignore */
  }
  try {
    timeline = (await getAuraBrainTimeline(8)).map((e) => ({
      id: e.id,
      title: e.title,
      at: e.at,
      href: e.href,
    }));
  } catch {
    /* ignore */
  }
  try {
    const favs = await listFavorites();
    homePins = filterFavoritesByPin(favs, "home").map((f) => ({
      id: f.id,
      title: f.title,
      href: f.href,
    }));
  } catch {
    /* ignore */
  }
  try {
    projectsWidget = await getHomeProjectsWidget();
  } catch {
    /* ignore */
  }
  try {
    knowledgeWidget = await getHomeKnowledgeWidget();
  } catch {
    /* ignore */
  }
  try {
    decisionWidget = await getHomeDecisionWidget();
  } catch {
    /* ignore */
  }
  try {
    scenarioWidget = await getHomeScenarioWidget();
  } catch {
    /* ignore */
  }
  try {
    priorityWidget = await getHomePriorityWidget();
  } catch {
    /* ignore */
  }

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-4"
      data-testid="personal-dashboard"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Meu Dia</h1>
          <p className="text-[12px] text-zinc-500">
            Smart Capture · Knowledge · Decision Support
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Link
            href="/dashboard/inbox"
            className="inline-flex min-h-11 items-center rounded border border-cyan-500/30 px-2.5 py-1 text-cyan-200 md:min-h-0"
          >
            Inbox{inboxCount ? ` (${inboxCount})` : ""}
          </Link>
          <Link
            href="/dashboard/decisions"
            className="inline-flex min-h-11 items-center rounded border border-orange-500/30 px-2.5 py-1 text-orange-100 md:min-h-0"
          >
            Decisões
          </Link>
          <Link
            href="/dashboard/scenarios"
            className="inline-flex min-h-11 items-center rounded border border-sky-500/30 px-2.5 py-1 text-sky-100 md:min-h-0"
          >
            Cenários
          </Link>
          <Link
            href="/dashboard/priorities"
            className="inline-flex min-h-11 items-center rounded border border-lime-500/30 px-2.5 py-1 text-lime-100 md:min-h-0"
          >
            Prioridades
          </Link>
          <Link
            href="/dashboard/knowledge"
            className="inline-flex min-h-11 items-center rounded border border-amber-500/30 px-2.5 py-1 text-amber-100 md:min-h-0"
          >
            Knowledge
          </Link>
          <Link
            href="/dashboard/projects"
            className="inline-flex min-h-11 items-center rounded border border-emerald-500/30 px-2.5 py-1 text-emerald-200 md:min-h-0"
          >
            Projetos
          </Link>
          <Link
            href="/dashboard/business"
            className="inline-flex min-h-11 items-center rounded border border-white/10 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 md:min-h-0"
          >
            Business
          </Link>
          <Link
            href="/dashboard/feed"
            className="inline-flex min-h-11 items-center rounded border border-white/10 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 md:min-h-0"
          >
            Feed
          </Link>
          <Link
            href="/dashboard/favorites"
            className="inline-flex min-h-11 items-center rounded border border-white/10 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 md:min-h-0"
          >
            Favoritos
          </Link>
          <Link
            href="/dashboard/discovery"
            className="inline-flex min-h-11 items-center rounded border border-white/10 px-2.5 py-1 text-zinc-400 hover:text-zinc-200 md:min-h-0"
          >
            Descobertas
          </Link>
        </div>
      </div>

      {homePins.length ? (
        <DashboardCard
          title="Fixados na Home"
          status="ok"
          testId="home-pinned-favorites"
        >
          <ul className="flex flex-wrap gap-2 text-[12px]">
            {homePins.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className="rounded border border-amber-500/30 px-2 py-1 text-amber-100/90"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardCard
          title="Projetos ativos"
          status={projectsWidget.active.length ? "ok" : "empty"}
          emptyTitle="Nenhum ativo"
          emptyDescription="Crie um projeto e mova para Ativo."
          href="/dashboard/projects"
          testId="home-projects-active"
        >
          <ul className="space-y-1 text-[12px]">
            {projectsWidget.active.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Projetos recentes"
          status={projectsWidget.recent.length ? "ok" : "empty"}
          emptyTitle="Sem projetos"
          emptyDescription="Transforme uma ideia em projeto."
          href="/dashboard/projects"
          testId="home-projects-recent"
        >
          <ul className="space-y-1 text-[12px]">
            {projectsWidget.recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.name}
                </Link>
                <span className="ml-1 text-[10px] text-zinc-600">
                  {PROJECT_STATUS_LABELS[p.status]}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Projetos favoritos"
          status={projectsWidget.favorites.length ? "ok" : "empty"}
          emptyTitle="Nenhum favorito"
          emptyDescription="Favorite projetos no board."
          href="/dashboard/favorites"
          testId="home-projects-favorites"
        >
          <ul className="space-y-1 text-[12px]">
            {projectsWidget.favorites.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="text-amber-100/90 hover:text-cyan-300"
                >
                  ★ {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <BrainNotificationsPanel />
      <MyDay />
      <SyncPanel compact />

      <DashboardCard
        title="Prioridades da semana"
        status={priorityWidget.weekPriorities.length ? "ok" : "empty"}
        emptyTitle="Sem prioridades"
        emptyDescription="Gere a fila no Priority Center."
        href="/dashboard/priorities"
        testId="home-week-priorities"
      >
        <ul className="space-y-1 text-[12px]">
          {priorityWidget.weekPriorities.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/priorities/${p.id}`}
                className="text-zinc-300 hover:text-cyan-300"
              >
                {p.ranking != null ? `#${p.ranking} ` : ""}
                {p.title}
                <span className="ml-1 text-zinc-600">
                  · score {p.priorityScore}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <DashboardCard
        title="Últimos cenários"
        status={scenarioWidget.recent.length ? "ok" : "empty"}
        emptyTitle="Sem cenários"
        emptyDescription='Simule um "E se…" no Scenario Center.'
        href="/dashboard/scenarios"
        testId="home-recent-scenarios"
      >
        <ul className="space-y-1 text-[12px]">
          {scenarioWidget.recent.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/scenarios/${s.id}`}
                className="text-zinc-300 hover:text-cyan-300"
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      </DashboardCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardCard
          title="Decisões prioritárias"
          status={decisionWidget.priorities.length ? "ok" : "empty"}
          emptyTitle="Sem prioridades"
          emptyDescription="Gere apoio à decisão no Decision Center."
          href="/dashboard/decisions"
          testId="home-decision-priorities"
        >
          <ul className="space-y-1 text-[12px]">
            {decisionWidget.priorities.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/decisions/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Em revisão"
          status={decisionWidget.inReview.length ? "ok" : "empty"}
          emptyTitle="Nada em revisão"
          emptyDescription="Sugestões de revisão aparecem aqui."
          href="/dashboard/decisions"
          testId="home-decision-review"
        >
          <ul className="space-y-1 text-[12px]">
            {decisionWidget.inReview.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/decisions/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Dados insuficientes"
          status={decisionWidget.insufficientData.length ? "ok" : "empty"}
          emptyTitle="Sem lacunas"
          emptyDescription="Quando faltarem dados, avisamos aqui."
          href="/dashboard/decisions"
          testId="home-decision-missing"
        >
          <ul className="space-y-1 text-[12px]">
            {decisionWidget.insufficientData.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/decisions/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardCard
          title="Documentos recentes"
          status={knowledgeWidget.recentDocuments.length ? "ok" : "empty"}
          emptyTitle="Sem documentos"
          emptyDescription="Adicione PDFs, links ou arquivos no Knowledge Hub."
          href="/dashboard/knowledge"
          testId="home-recent-documents"
        >
          <ul className="space-y-1 text-[12px]">
            {knowledgeWidget.recentDocuments.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/knowledge/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Notas recentes"
          status={knowledgeWidget.recentNotes.length ? "ok" : "empty"}
          emptyTitle="Sem notas"
          emptyDescription="Crie uma nota Markdown no hub."
          href="/dashboard/knowledge"
          testId="home-recent-notes"
        >
          <ul className="space-y-1 text-[12px]">
            {knowledgeWidget.recentNotes.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/knowledge/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Conhecimento atualizado"
          status={knowledgeWidget.updatedKnowledge.length ? "ok" : "empty"}
          emptyTitle="Nada atualizado"
          emptyDescription="OCR, edições e versões aparecem aqui."
          href="/dashboard/knowledge"
          testId="home-updated-knowledge"
        >
          <ul className="space-y-1 text-[12px]">
            {knowledgeWidget.updatedKnowledge.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dashboard/knowledge/${d.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DashboardCard
          title="Memórias recentes"
          status={recentMemories.length ? "ok" : "empty"}
          emptyTitle="Registre sua primeira memória"
          emptyDescription="Use Capturar para começar em menos de 10 segundos."
          href="/dashboard/inbox"
          testId="home-recent-memories"
        >
          <ul className="space-y-1 text-[12px]">
            {recentMemories.map((m) => (
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

        <DashboardCard
          title="Timeline resumida"
          status={timeline.length ? "ok" : "empty"}
          emptyTitle="Sem eventos ainda"
          emptyDescription="Capture memórias e atualize descobertas."
          href="/dashboard/discovery"
          testId="home-timeline-summary"
        >
          <ul className="space-y-1 text-[12px]">
            {timeline.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className="text-zinc-300 hover:text-cyan-300">
                  {e.title}
                </Link>
                <span className="ml-2 text-[10px] text-zinc-600">
                  {new Date(e.at).toLocaleDateString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      <RecentActivityPanel limit={10} />
    </div>
  );
}
