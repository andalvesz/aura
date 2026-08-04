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
import { getHomeRecommendationWidget } from "@/lib/supabase/services/recommendation.service";
import { getHomePlanWidget } from "@/lib/supabase/services/planner.service";
import { getHomeAutomationWidget } from "@/lib/supabase/services/automation.service";
import { getHomeAgentWidget } from "@/lib/supabase/services/agent-runtime.service";
import { loadOrchestratorHome } from "@/lib/supabase/services/orchestrator.service";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { filterFavoritesByPin } from "@/lib/smart-capture/pins";
import { PROJECT_STATUS_LABELS } from "@/lib/projects/types";
import { ContextStrip } from "@/components/dashboard/orchestrator/context-strip";
import { QuickActionsPanel } from "@/components/dashboard/orchestrator/quick-actions-panel";
import { GlobalTimelinePanel } from "@/components/dashboard/orchestrator/global-timeline-panel";
import { SmartLinksPanel } from "@/components/dashboard/orchestrator/smart-links-panel";
import { ConversationHomeWidget } from "@/components/dashboard/conversation/conversation-home-widget";
import { LearningHomeWidget } from "@/components/dashboard/learning/learning-home-widget";
import { BusinessExpertHomeWidget } from "@/components/dashboard/business-expert/business-expert-home-widget";
import { buildSmartLinks } from "@/lib/orchestrator/smart-links";
import type { AuraHomeWidgetId } from "@/lib/orchestrator/types";

/**
 * Aura Home — Sprint 9.0 Operating System surface.
 * Coordinates existing Sprint 7–8 widgets via Orchestrator (no parallel engines).
 */
export async function PersonalDashboard() {
  let auraHome: Awaited<ReturnType<typeof loadOrchestratorHome>> | null = null;
  try {
    auraHome = await loadOrchestratorHome();
  } catch {
    auraHome = null;
  }

  const widgetScore = (id: AuraHomeWidgetId) => {
    const found = auraHome?.widgetOrder.find((w) => w.id === id);
    return found ? 1000 - found.score : 500;
  };
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
  let recommendationWidget: Awaited<
    ReturnType<typeof getHomeRecommendationWidget>
  > = {
    weekRecommendations: [],
  };
  let planWidget: Awaited<ReturnType<typeof getHomePlanWidget>> = {
    pendingApproval: [],
    active: [],
    blockedSteps: [],
    upcomingMilestones: [],
    withoutOwner: [],
  };
  let automationWidget: Awaited<ReturnType<typeof getHomeAutomationWidget>> = {
    awaitingConfirmation: [],
    scheduledToday: [],
    executedToday: [],
    failed: [],
    blocked: [],
  };
  let agentWidget: Awaited<ReturnType<typeof getHomeAgentWidget>> = {
    active: [],
    awaitingConfirmation: [],
    awaitingInput: [],
    completedToday: [],
    failed: [],
    upcomingReviews: [],
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
  try {
    recommendationWidget = await getHomeRecommendationWidget();
  } catch {
    /* ignore */
  }
  try {
    planWidget = await getHomePlanWidget();
  } catch {
    /* ignore */
  }
  try {
    automationWidget = await getHomeAutomationWidget();
  } catch {
    /* ignore */
  }
  try {
    agentWidget = await getHomeAgentWidget();
  } catch {
    /* ignore */
  }

  const homeSmartLinks = buildSmartLinks({
    focusTitle: auraHome?.context.answers.whichActiveProject ?? "",
    focusTags: [
      auraHome?.context.answers.whichMission ?? "",
      ...(auraHome?.context.answers.whichPriorities ?? []).slice(0, 3),
    ].filter(Boolean),
    candidates: [
      ...(auraHome?.context.slice.recommendations ?? []).map((r) => ({
        id: r.id,
        kind: "recommendation" as const,
        title: r.label,
        href: r.href ?? "/dashboard/recommendations",
        tags: [r.label],
      })),
      ...(auraHome?.context.slice.activeAgents ?? []).map((a) => ({
        id: a.id,
        kind: "agent" as const,
        title: a.label,
        href: a.href ?? "/dashboard/agents",
        tags: [a.label],
      })),
      ...recentMemories.map((m) => ({
        id: m.id,
        kind: "memory" as const,
        title: m.title,
        href: `/dashboard/settings/memory#${m.id}`,
        tags: [m.title],
      })),
      ...knowledgeWidget.recentDocuments.map((d) => ({
        id: d.id,
        kind: "knowledge" as const,
        title: d.title,
        href: `/dashboard/knowledge/${d.id}`,
        tags: [d.title],
      })),
      ...planWidget.active.map((p) => ({
        id: p.id,
        kind: "plan" as const,
        title: p.title,
        href: `/dashboard/plans/${p.id}`,
        tags: [p.title],
      })),
    ],
  });

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      data-testid="personal-dashboard"
      data-aura-home="true"
    >
      <div className="flex flex-wrap items-end justify-between gap-2" style={{ order: widgetScore("today") }}>
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Aura Home</h1>
          <p className="text-[12px] text-zinc-500">
            Sistema operacional · contexto único · módulos coordenados
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
            href="/dashboard/recommendations"
            className="inline-flex min-h-11 items-center rounded border border-violet-500/30 px-2.5 py-1 text-violet-100 md:min-h-0"
          >
            Recomendações
          </Link>
          <Link
            href="/dashboard/plans"
            className="inline-flex min-h-11 items-center rounded border border-teal-500/30 px-2.5 py-1 text-teal-100 md:min-h-0"
          >
            Planos
          </Link>
          <Link
            href="/dashboard/automations"
            className="inline-flex min-h-11 items-center rounded border border-cyan-500/30 px-2.5 py-1 text-cyan-100 md:min-h-0"
          >
            Automações
          </Link>
          <Link
            href="/dashboard/agents"
            className="inline-flex min-h-11 items-center rounded border border-indigo-500/30 px-2.5 py-1 text-indigo-100 md:min-h-0"
          >
            Agentes
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
            href="/dashboard/business-expert"
            className="inline-flex min-h-11 items-center rounded border border-emerald-500/30 px-2.5 py-1 text-emerald-100 md:min-h-0"
          >
            Business Expert
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

      {auraHome ? (
        <div style={{ order: widgetScore("quick-actions") - 5 }}>
          <ContextStrip context={auraHome.context} />
        </div>
      ) : null}

      {auraHome ? (
        <div style={{ order: widgetScore("quick-actions") }}>
          <QuickActionsPanel
            actions={[
              {
                id: "qa-brain",
                label: "Perguntar ao Aura",
                href: "/dashboard/brain",
                kind: "custom",
              },
              ...auraHome.quickActions,
            ]}
          />
        </div>
      ) : null}

      <div style={{ order: widgetScore("quick-actions") + 1 }}>
        <ConversationHomeWidget />
      </div>

      <div style={{ order: widgetScore("quick-actions") + 2 }}>
        <LearningHomeWidget />
      </div>

      <div style={{ order: widgetScore("quick-actions") + 3 }}>
        <BusinessExpertHomeWidget />
      </div>

      {auraHome?.context.slice.nextActions.length ||
      auraHome?.context.slice.risks.length ? (
        <div style={{ order: widgetScore("alerts") }} data-testid="aura-home-alerts">
          <DashboardCard
            title="Alertas e próximas ações"
            status="ok"
            href="/dashboard/priorities"
            testId="home-next-actions"
          >
            <ul className="space-y-1 text-[12px]">
              {(auraHome?.context.slice.nextActions ?? []).map((a) => (
                <li key={`na-${a.id}`}>
                  <Link
                    href={a.href ?? "/dashboard"}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
              {(auraHome?.context.slice.risks ?? []).slice(0, 5).map((r) => (
                <li key={`risk-${r.id}`}>
                  <Link
                    href={r.href ?? "/dashboard"}
                    className="text-amber-200/90 hover:text-cyan-300"
                  >
                    Risco: {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      ) : null}

      {auraHome ? (
        <div style={{ order: widgetScore("timeline") - 1 }}>
          <GlobalTimelinePanel entries={auraHome.timeline} />
        </div>
      ) : null}

      <div style={{ order: widgetScore("timeline") }}>
        <SmartLinksPanel bundle={homeSmartLinks} title="Links inteligentes do contexto" />
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

      <div className="grid gap-3 sm:grid-cols-3" style={{ order: widgetScore("projects") }}>
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

      <div style={{ order: widgetScore("today") + 1 }}>
        <BrainNotificationsPanel />
      </div>
      <div style={{ order: widgetScore("today") + 2 }}>
        <MyDay />
      </div>
      <div style={{ order: widgetScore("today") + 3 }}>
        <SyncPanel compact />
      </div>

      <div style={{ order: widgetScore("priorities") }}>
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
      </div>

      <div style={{ order: widgetScore("recommendations") }}>
      <DashboardCard
        title="Recomendações da semana"
        status={
          recommendationWidget.weekRecommendations.length ? "ok" : "empty"
        }
        emptyTitle="Sem recomendações"
        emptyDescription="Gere no Recommendation Center."
        href="/dashboard/recommendations"
        testId="home-week-recommendations"
      >
        <ul className="space-y-1 text-[12px]">
          {recommendationWidget.weekRecommendations.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/recommendations/${r.id}`}
                className="text-zinc-300 hover:text-cyan-300"
              >
                {r.ranking != null ? `#${r.ranking} ` : ""}
                {r.title}
                <span className="ml-1 text-zinc-600">
                  · score {r.priorityScore}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </DashboardCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" style={{ order: widgetScore("plans") }}>
        <DashboardCard
          title="Planos aguardando aprovação"
          status={planWidget.pendingApproval.length ? "ok" : "empty"}
          emptyTitle="Nenhum pendente"
          emptyDescription="Gere planos no Plan Center."
          href="/dashboard/plans"
          testId="home-plans-pending"
        >
          <ul className="space-y-1 text-[12px]">
            {planWidget.pendingApproval.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Planos ativos"
          status={planWidget.active.length ? "ok" : "empty"}
          emptyTitle="Nenhum ativo"
          emptyDescription="Aprove e inicie um plano."
          href="/dashboard/plans"
          testId="home-plans-active"
        >
          <ul className="space-y-1 text-[12px]">
            {planWidget.active.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Etapas bloqueadas"
          status={planWidget.blockedSteps.length ? "ok" : "empty"}
          emptyTitle="Nenhuma bloqueada"
          emptyDescription="Sem bloqueios no momento."
          href="/dashboard/plans"
          testId="home-plans-blocked-steps"
        >
          <ul className="space-y-1 text-[12px]">
            {planWidget.blockedSteps.map((b) => (
              <li key={b.step.id}>
                <Link
                  href={`/dashboard/plans/${b.planId}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {b.planTitle}: {b.step.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
        <DashboardCard
          title="Próximos marcos"
          status={planWidget.upcomingMilestones.length ? "ok" : "empty"}
          emptyTitle="Sem marcos"
          emptyDescription="Marcos aparecem após gerar planos."
          href="/dashboard/plans"
          testId="home-plans-milestones"
        >
          <ul className="space-y-1 text-[12px]">
            {planWidget.upcomingMilestones.map((m) => (
              <li key={m.milestone.id}>
                <Link
                  href={`/dashboard/plans/${m.planId}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {m.milestone.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      {planWidget.withoutOwner.length ? (
        <DashboardCard
          title="Planos sem responsável"
          status="ok"
          href="/dashboard/plans"
          testId="home-plans-no-owner"
        >
          <ul className="space-y-1 text-[12px]">
            {planWidget.withoutOwner.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/plans/${p.id}`}
                  className="text-zinc-300 hover:text-cyan-300"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <section data-testid="home-automations-block" className="space-y-2" style={{ order: widgetScore("automations") }}>
        <h2 className="text-[13px] font-medium text-zinc-200">
          Automações do Aura Brain
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardCard
            title="Aguardando confirmação"
            status={
              automationWidget.awaitingConfirmation.length ? "ok" : "empty"
            }
            emptyTitle="Nada pendente"
            emptyDescription="Confirmações de automações aparecem aqui."
            href="/dashboard/automations"
            testId="home-automations-awaiting"
          >
            <ul className="space-y-1 text-[12px]">
              {automationWidget.awaitingConfirmation.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/automations/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Agendadas para hoje"
            status={automationWidget.scheduledToday.length ? "ok" : "empty"}
            emptyTitle="Nada agendado"
            emptyDescription="Automações do dia aparecem aqui."
            href="/dashboard/automations"
            testId="home-automations-scheduled"
          >
            <ul className="space-y-1 text-[12px]">
              {automationWidget.scheduledToday.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/automations/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Executadas hoje"
            status={automationWidget.executedToday.length ? "ok" : "empty"}
            emptyTitle="Nenhuma execução"
            emptyDescription="Resultados do dia aparecem aqui."
            href="/dashboard/automations"
            testId="home-automations-executed"
          >
            <ul className="space-y-1 text-[12px]">
              {automationWidget.executedToday.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/automations/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Falhas / bloqueadas"
            status={
              automationWidget.failed.length || automationWidget.blocked.length
                ? "ok"
                : "empty"
            }
            emptyTitle="Sem falhas"
            emptyDescription="Bloqueios e erros aparecem aqui."
            href="/dashboard/automations"
            testId="home-automations-failed"
          >
            <ul className="space-y-1 text-[12px]">
              {[...automationWidget.failed, ...automationWidget.blocked].map(
                (a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/automations/${a.id}`}
                      className="text-zinc-300 hover:text-cyan-300"
                    >
                      {a.title}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </DashboardCard>
        </div>
      </section>

      <section data-testid="home-agents-block" className="space-y-2" style={{ order: widgetScore("agents") }}>
        <h2 className="text-[13px] font-medium text-zinc-200">
          Atividade dos agentes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardCard
            title="Sessões ativas"
            status={agentWidget.active.length ? "ok" : "empty"}
            emptyTitle="Nenhuma ativa"
            emptyDescription="Sessões de agentes aparecem aqui."
            href="/dashboard/agents"
            testId="home-agents-active"
          >
            <ul className="space-y-1 text-[12px]">
              {agentWidget.active.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/agents/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.objective}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Aguardando confirmação / resposta"
            status={
              agentWidget.awaitingConfirmation.length ||
              agentWidget.awaitingInput.length
                ? "ok"
                : "empty"
            }
            emptyTitle="Nada pendente"
            emptyDescription="Confirmações e perguntas aparecem aqui."
            href="/dashboard/agents"
            testId="home-agents-waiting"
          >
            <ul className="space-y-1 text-[12px]">
              {[
                ...agentWidget.awaitingConfirmation,
                ...agentWidget.awaitingInput,
              ].map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/agents/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.objective}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Concluídas hoje"
            status={agentWidget.completedToday.length ? "ok" : "empty"}
            emptyTitle="Nenhuma conclusão"
            emptyDescription="Sessões do dia aparecem aqui."
            href="/dashboard/agents"
            testId="home-agents-completed"
          >
            <ul className="space-y-1 text-[12px]">
              {agentWidget.completedToday.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/agents/${a.id}`}
                    className="text-zinc-300 hover:text-cyan-300"
                  >
                    {a.objective}
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardCard>
          <DashboardCard
            title="Falhas / próximas revisões"
            status={
              agentWidget.failed.length || agentWidget.upcomingReviews.length
                ? "ok"
                : "empty"
            }
            emptyTitle="Sem falhas"
            emptyDescription="Falhas e revisões aparecem aqui."
            href="/dashboard/agents"
            testId="home-agents-failed"
          >
            <ul className="space-y-1 text-[12px]">
              {[...agentWidget.failed, ...agentWidget.upcomingReviews].map(
                (a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/agents/${a.id}`}
                      className="text-zinc-300 hover:text-cyan-300"
                    >
                      {a.objective}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </DashboardCard>
        </div>
      </section>

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

      <div className="grid gap-3 sm:grid-cols-3" style={{ order: widgetScore("knowledge") }}>
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
