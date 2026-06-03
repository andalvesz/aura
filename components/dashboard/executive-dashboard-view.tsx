"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Dumbbell,
  Film,
  LayoutDashboard,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  useConteudos,
  useEventos,
  useGrowthGoals,
  useGrowthLeads,
  useGrowthMissions,
  useHealthHabits,
} from "@/hooks";
import { formatBRL, formatDate, formatTime, isToday } from "@/utils/format";
import {
  analyzeGrowthLeadContentInsights,
  buildExecutivePriorities,
  computeGrowthLeadMetrics,
  computeMonthlyExecutiveScore,
  computeRevenueProgress,
  detectExecutiveAlerts,
  getCurrentGoal,
  getGrowthLeadPriority,
  getGrowthLeadStatusLabel,
  mergeDailyMissions,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import { todayIsoDate } from "@/utils/health";
import { filterUpcomingEventos } from "@/utils/nexus";
import {
  getConteudoStatusLabel,
  normalizeConteudoStatus,
} from "@/utils/social";

function formatTodayHeader() {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function PriorityBadge({ status }: { status: string }) {
  const priority = getGrowthLeadPriority(
    status as Parameters<typeof getGrowthLeadPriority>[0]
  );
  const styles =
    priority === "ALTA"
      ? "bg-rose-500/10 text-rose-400"
      : priority === "MÉDIA"
        ? "bg-amber-500/10 text-amber-400"
        : "bg-zinc-500/10 text-zinc-400";

  return (
    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles}`}>
      {priority}
    </span>
  );
}

function ListItem({
  title,
  subtitle,
  badge,
  href,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03]">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-zinc-200">{title}</p>
        {subtitle && (
          <p className="truncate text-[11px] text-zinc-600">{subtitle}</p>
        )}
      </div>
      {badge}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export function ExecutiveDashboardView() {
  const { data: growthLeads, loading: leadsLoading } = useGrowthLeads();
  const { data: goals, loading: goalsLoading } = useGrowthGoals();
  const { data: missions, loading: missionsLoading } = useGrowthMissions();
  const { data: eventos, loading: eventosLoading } = useEventos();
  const { data: conteudos, loading: conteudosLoading } = useConteudos();
  const { data: habits, loading: habitsLoading } = useHealthHabits();

  const loading =
    leadsLoading ||
    goalsLoading ||
    missionsLoading ||
    eventosLoading ||
    conteudosLoading ||
    habitsLoading;

  const dashboard = useMemo(() => {
    const leadMetrics = computeGrowthLeadMetrics(growthLeads);
    const currentGoal = getCurrentGoal(goals);
    const revenueProgress = computeRevenueProgress(currentGoal);
    const todayMissions = mergeDailyMissions(missions);
    const pendingMissions = todayMissions.filter((m) => m.status === "pending");
    const completedMissions = todayMissions.filter((m) => m.status === "completed");
    const priorityLeads = sortGrowthLeadOpportunities(growthLeads).slice(0, 5);
    const upcomingEvents = filterUpcomingEventos(eventos, 14).slice(0, 5);
    const pendingContent = conteudos
      .filter((c) => normalizeConteudoStatus(c.status) !== "publicado")
      .slice(0, 5);
    const habitsHoje = habits.filter((h) => h.data === todayIsoDate());
    const contentInsights = analyzeGrowthLeadContentInsights(growthLeads);
    const executiveScore = computeMonthlyExecutiveScore(missions, growthLeads);
    const alerts = detectExecutiveAlerts(growthLeads, missions, leadMetrics);
    const priorities = buildExecutivePriorities(
      growthLeads,
      missions,
      contentInsights
    );

    const metaMensal = currentGoal?.meta_receita_mensal ?? 0;
    const receitaAtual = currentGoal?.receita_atual ?? 0;
    const faltaMeta = Math.max(0, metaMensal - receitaAtual);

    return {
      leadMetrics,
      currentGoal,
      revenueProgress,
      todayMissions,
      pendingMissions,
      completedMissions,
      priorityLeads,
      upcomingEvents,
      pendingContent,
      habitsHoje,
      executiveScore,
      alerts,
      priorities,
      metaMensal,
      receitaAtual,
      faltaMeta,
      totalPendingContent: conteudos.filter(
        (c) => normalizeConteudoStatus(c.status) !== "publicado"
      ).length,
    };
  }, [growthLeads, goals, missions, eventos, conteudos, habits]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded-md bg-white/[0.06]" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-white/[0.04]" />
        </div>
        <MetricsSkeleton count={4} />
        <div className="grid gap-3 lg:grid-cols-2">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5 text-violet-400" />
            <h1 className="text-2xl font-semibold text-zinc-100">
              Dashboard Executivo
            </h1>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{formatTodayHeader()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-2 text-right">
            <p className="text-[10px] text-zinc-600">Score do mês</p>
            <p className="text-lg font-semibold text-zinc-100">
              {dashboard.executiveScore}
              <span className="text-sm font-normal text-zinc-600">/100</span>
            </p>
          </div>
          <Link
            href="/dashboard/crescimento"
            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-[12px] font-medium text-violet-300 transition-colors hover:border-violet-500/30 hover:bg-violet-500/15"
          >
            <Sparkles className="size-3.5" />
            Aura Mentor
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard
          label="Receita potencial"
          value={formatBRL(dashboard.leadMetrics.receitaPotencial)}
          hint={`${dashboard.leadMetrics.ativos} leads ativos`}
        />
        <MetricCard
          label="Meta mensal"
          value={
            dashboard.metaMensal > 0
              ? formatBRL(dashboard.receitaAtual)
              : "—"
          }
          hint={
            dashboard.metaMensal > 0
              ? `${dashboard.revenueProgress}% · faltam ${formatBRL(dashboard.faltaMeta)}`
              : "Meta não definida"
          }
          hintClassName={
            dashboard.revenueProgress >= 75 ? "text-emerald-500/80" : undefined
          }
        />
        <MetricCard
          label="Missões pendentes"
          value={String(dashboard.pendingMissions.length)}
          hint={`${dashboard.completedMissions.length}/${dashboard.todayMissions.length} concluídas hoje`}
        />
        <MetricCard
          label="Conteúdos pendentes"
          value={String(dashboard.totalPendingContent)}
          hint="Ideias, roteiros e produção"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Target className="size-3.5 text-violet-400" />
              Resumo do dia
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3">
            {dashboard.priorities.length === 0 && dashboard.alerts.length === 0 ? (
              <EmptyState
                title="Nenhuma prioridade calculada"
                description="Cadastre leads, missões e metas para personalizar seu dia."
              />
            ) : (
              <>
                {dashboard.priorities.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Prioridades
                    </p>
                    <ol className="space-y-1">
                      {dashboard.priorities.slice(0, 4).map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-[12px] text-zinc-300"
                        >
                          <span className="shrink-0 font-medium text-violet-400">
                            {i + 1}.
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {dashboard.alerts.length > 0 && (
                  <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Alertas
                    </p>
                    <ul className="space-y-1">
                      {dashboard.alerts.slice(0, 3).map((alert, i) => (
                        <li key={i} className="text-[11px] text-amber-400/90">
                          {alert}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-emerald-400" />
              Meta mensal
            </PanelTitle>
            <Link
              href="/dashboard/crescimento"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Gerenciar
            </Link>
          </PanelHeader>
          <PanelContent>
            {!dashboard.currentGoal || dashboard.metaMensal <= 0 ? (
              <EmptyState
                title="Meta não definida"
                description="Configure sua meta de receita mensal no módulo Crescimento."
                action={
                  <Link
                    href="/dashboard/crescimento"
                    className="text-[12px] text-violet-400 hover:text-violet-300"
                  >
                    Definir meta →
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-zinc-500">Receita atual</p>
                    <p className="text-xl font-semibold text-zinc-100">
                      {formatBRL(dashboard.receitaAtual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-zinc-500">Meta</p>
                    <p className="text-[13px] font-medium text-zinc-300">
                      {formatBRL(dashboard.metaMensal)}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
                    <span>{dashboard.revenueProgress}% da meta</span>
                    <span>Faltam {formatBRL(dashboard.faltaMeta)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-emerald-500/70 transition-all"
                      style={{ width: `${dashboard.revenueProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Receita fechada (CRM):{" "}
                  <span className="text-zinc-400">
                    {formatBRL(dashboard.leadMetrics.receita)}
                  </span>
                </p>
              </div>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <Users className="size-3.5 text-cyan-400" />
              Leads prioritários
            </PanelTitle>
            <Link
              href="/dashboard/crescimento"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Ver todos
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {dashboard.priorityLeads.length === 0 ? (
              <EmptyState
                title="Nenhum lead ativo"
                description="Cadastre oportunidades no CRM de Crescimento."
              />
            ) : (
              dashboard.priorityLeads.map((lead) => (
                <ListItem
                  key={lead.id}
                  title={lead.nome}
                  subtitle={`${getGrowthLeadStatusLabel(lead.status)} · ${formatBRL(lead.valor_potencial ?? 0)}`}
                  badge={<PriorityBadge status={lead.status} />}
                  href="/dashboard/crescimento"
                />
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-sky-400" />
              Próximos eventos
            </PanelTitle>
            <Link
              href="/dashboard/calendario"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Agenda
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {dashboard.upcomingEvents.length === 0 ? (
              <EmptyState
                title="Nenhum evento próximo"
                description="Sua agenda está livre nos próximos 14 dias."
              />
            ) : (
              dashboard.upcomingEvents.map((evento) => {
                const dayLabel = isToday(evento.data_inicio.slice(0, 10))
                  ? "Hoje"
                  : formatDate(evento.data_inicio);
                return (
                  <ListItem
                    key={evento.id}
                    title={evento.titulo}
                    subtitle={`${dayLabel} · ${formatTime(evento.data_inicio)}${evento.local ? ` · ${evento.local}` : ""}`}
                    href="/dashboard/calendario"
                  />
                );
              })
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <Circle className="size-3.5 text-amber-400" />
              Missões pendentes
            </PanelTitle>
            <Link
              href="/dashboard/crescimento"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Missões
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {dashboard.pendingMissions.length === 0 ? (
              dashboard.todayMissions.length === 0 ? (
                <EmptyState
                  title="Nenhuma missão hoje"
                  description="As missões diárias aparecem no módulo Crescimento."
                />
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="mb-2 size-8 text-emerald-500/60" />
                  <p className="text-[13px] font-medium text-zinc-300">
                    Todas as missões concluídas
                  </p>
                  <p className="mt-1 text-[12px] text-zinc-600">
                    {dashboard.completedMissions.length} missões feitas hoje
                  </p>
                </div>
              )
            ) : (
              dashboard.pendingMissions.map((mission) => (
                <ListItem
                  key={mission.key}
                  title={mission.titulo}
                  subtitle={mission.descricao}
                  badge={
                    <span className="shrink-0 text-[10px] text-amber-400">
                      +{mission.xp} XP
                    </span>
                  }
                  href="/dashboard/crescimento"
                />
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <Film className="size-3.5 text-pink-400" />
              Conteúdos pendentes
            </PanelTitle>
            <Link
              href="/dashboard/social-media"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Social Media
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {dashboard.pendingContent.length === 0 ? (
              <EmptyState
                title="Nenhum conteúdo pendente"
                description="Crie ideias e roteiros no módulo Social Media."
              />
            ) : (
              dashboard.pendingContent.map((conteudo) => (
                <ListItem
                  key={conteudo.id}
                  title={conteudo.titulo}
                  subtitle={`${conteudo.plataforma} · ${getConteudoStatusLabel(normalizeConteudoStatus(conteudo.status))}`}
                  href="/dashboard/social-media"
                />
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <Dumbbell className="size-3.5 text-orange-400" />
              Hábitos de saúde do dia
            </PanelTitle>
            <Link
              href="/dashboard/saude"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Saúde
            </Link>
          </PanelHeader>
          <PanelContent>
            {dashboard.habitsHoje.length === 0 ? (
              <EmptyState
                title="Nenhum hábito registrado hoje"
                description="Registre hábitos e rotinas no módulo Saúde."
                action={
                  <Link
                    href="/dashboard/saude"
                    className="text-[12px] text-orange-400 hover:text-orange-300"
                  >
                    Ir para Saúde →
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {dashboard.habitsHoje.map((habit) => (
                  <ListItem
                    key={habit.id}
                    title={habit.titulo}
                    subtitle={`${habit.frequencia} · ${habit.status}`}
                    href="/dashboard/saude"
                  />
                ))}
              </div>
            )}
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
