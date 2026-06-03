"use client";

import Link from "next/link";
import {
  CalendarPlus,
  Clapperboard,
  Dumbbell,
  LayoutDashboard,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { ActionButton } from "@/components/dashboard/action-button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  useClientes,
  useConteudos,
  useEventos,
  useGastos,
  useGrowthGoals,
  useGrowthLeads,
  useGrowthMissions,
  useHealthHabits,
  useHealthWorkouts,
  useOrcamentos,
} from "@/hooks";
import type {
  GrowthLeadCanal,
  GrowthLeadStatus,
  GrowthVertical,
} from "@/types/database";
import { getCurrentMonthReference, getGrowthLeadPriority } from "@/utils/growth";
import {
  buildExecutiveAgenda,
  buildExecutiveDaySummary,
  buildExecutiveFeedFallback,
  buildExecutiveKpis,
  buildExecutivePriorityItems,
  hasAnyExecutiveData,
  type ExecutiveFeedItem,
} from "@/utils/executive";
import { formatBRL, formatTime } from "@/utils/format";
import type { OrcamentoWithCliente } from "@/utils/nexus";
import { parseJsonResponse } from "@/utils/safe-json";
import { AddClienteModal } from "./modules/add-cliente-modal";
import { AddConteudoModal, type ConteudoFormPayload } from "./modules/add-conteudo-modal";
import { AddEventoModal } from "./modules/add-evento-modal";
import { AddGrowthLeadModal } from "./modules/add-growth-lead-modal";
import { AddHealthWorkoutModal } from "./modules/add-health-workout-modal";
import { SetGrowthGoalModal } from "./modules/set-growth-goal-modal";

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

export function ExecutiveDashboardView() {
  const { data: growthLeads, loading: leadsLoading, create: createLead } =
    useGrowthLeads();
  const {
    data: goals,
    loading: goalsLoading,
    create: createGoal,
    update: updateGoal,
  } = useGrowthGoals();
  const { data: missions, loading: missionsLoading } = useGrowthMissions();
  const { data: eventos, loading: eventosLoading, create: createEvento } =
    useEventos();
  const { data: conteudos, loading: conteudosLoading, create: createConteudo } =
    useConteudos();
  const { data: habits, loading: habitsLoading } = useHealthHabits();
  const { data: workouts, loading: workoutsLoading, create: createWorkout } =
    useHealthWorkouts();
  const { data: orcamentos, loading: orcamentosLoading } = useOrcamentos();
  const { data: clientes, loading: clientesLoading, create: createCliente } =
    useClientes();
  const { data: gastos, loading: gastosLoading } = useGastos();

  const [leadModal, setLeadModal] = useState(false);
  const [eventoModal, setEventoModal] = useState(false);
  const [conteudoModal, setConteudoModal] = useState(false);
  const [treinoModal, setTreinoModal] = useState(false);
  const [clienteModal, setClienteModal] = useState(false);
  const [goalModal, setGoalModal] = useState(false);
  const [feedItems, setFeedItems] = useState<ExecutiveFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const loading =
    leadsLoading ||
    goalsLoading ||
    missionsLoading ||
    eventosLoading ||
    conteudosLoading ||
    habitsLoading ||
    workoutsLoading ||
    orcamentosLoading ||
    clientesLoading ||
    gastosLoading;

  const orcamentosWithClientes = useMemo((): OrcamentoWithCliente[] => {
    const byId = new Map(clientes.map((c) => [c.id, c]));
    return orcamentos.map((o) => ({
      ...o,
      clientes: o.cliente_id
        ? byId.get(o.cliente_id)
          ? {
              nome: byId.get(o.cliente_id)!.nome,
              telefone: byId.get(o.cliente_id)!.telefone,
              email: byId.get(o.cliente_id)!.email,
            }
          : null
        : null,
    }));
  }, [orcamentos, clientes]);

  const dashboard = useMemo(() => {
    const daySummary = buildExecutiveDaySummary({
      eventos,
      leads: growthLeads,
      conteudos,
      missions,
      habits,
      workouts,
    });
    const kpis = buildExecutiveKpis({
      goals,
      leads: growthLeads,
      conteudos,
      habits,
      workouts,
      eventos,
      orcamentos: orcamentosWithClientes,
      gastos,
    });
    const priorities = buildExecutivePriorityItems({
      leads: growthLeads,
      orcamentos: orcamentosWithClientes,
      conteudos,
      habits,
    });
    const agenda = buildExecutiveAgenda(eventos);
    const feedFallback = buildExecutiveFeedFallback({
      leads: growthLeads,
      conteudos,
      habits,
      workouts,
      missions,
      goals,
    });
    const hasData = hasAnyExecutiveData({
      eventos,
      leads: growthLeads,
      conteudos,
      habits,
      workouts,
      orcamentos,
      gastos,
    });

    return { daySummary, kpis, priorities, agenda, feedFallback, hasData };
  }, [
    eventos,
    growthLeads,
    conteudos,
    missions,
    habits,
    workouts,
    goals,
    orcamentosWithClientes,
    gastos,
    orcamentos,
  ]);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function loadFeed() {
      setFeedLoading(true);
      try {
        const res = await fetch("/api/executive-feed", { method: "POST" });
        const { data, error: parseError } = await parseJsonResponse<{
          items?: ExecutiveFeedItem[];
          useFallback?: boolean;
        }>(res);

        if (cancelled) return;

        if (
          !parseError &&
          data?.items &&
          data.items.length > 0 &&
          !data.useFallback
        ) {
          setFeedItems(data.items);
        } else {
          setFeedItems(dashboard.feedFallback);
        }
      } catch {
        if (!cancelled) setFeedItems(dashboard.feedFallback);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }

    loadFeed();
    return () => {
      cancelled = true;
    };
  }, [loading, dashboard.feedFallback]);

  async function handleCreateLead(payload: {
    nome: string;
    contato: string;
    origem: string;
    canal: GrowthLeadCanal;
    vertical: GrowthVertical | null;
    status: GrowthLeadStatus;
    valor_potencial: number;
    observacoes: string;
  }) {
    const result = await createLead({
      nome: payload.nome,
      contato: payload.contato || null,
      origem: payload.origem,
      canal: payload.canal,
      vertical: payload.vertical,
      status: payload.status,
      valor_potencial: payload.valor_potencial,
      observacoes: payload.observacoes || null,
    });
    return { error: result.error };
  }

  async function handleSetGoal(metaReceita: number) {
    const mesReferencia = getCurrentMonthReference();
    const currentGoal = goals.find((g) => g.mes_referencia === mesReferencia);
    if (currentGoal) {
      const result = await updateGoal(currentGoal.id, {
        meta_receita_mensal: metaReceita,
      });
      return { error: result.error };
    }
    const result = await createGoal({
      meta_receita_mensal: metaReceita,
      receita_atual: 0,
      xp_total: 0,
      nivel: 1,
      mes_referencia: mesReferencia,
    });
    return { error: result.error };
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-7 w-48 animate-pulse rounded-md bg-white/[0.06]" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-white/[0.04]" />
        </div>
        <MetricsSkeleton count={6} />
        <div className="grid gap-3 lg:grid-cols-2">
          <ListSkeleton rows={4} />
          <ListSkeleton rows={4} />
        </div>
      </div>
    );
  }

  const { daySummary, kpis, priorities, agenda } = dashboard;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5 shrink-0 text-violet-400" />
            <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Visão Geral</h1>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">Centro de comando · Aura OS</p>
        </div>
        <Link
          href="/dashboard/crescimento"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 text-[12px] font-medium text-violet-300 transition-colors hover:border-violet-500/30 hover:bg-violet-500/15 sm:w-auto sm:min-h-0 sm:py-2"
        >
          <Sparkles className="size-3.5" />
          Aura Mentor
        </Link>
      </div>

      {/* Seção 1 — Resumo do dia */}
      <Panel className="border-violet-500/10 bg-violet-500/[0.03]">
        <PanelContent className="py-4">
          <p className="text-[11px] text-zinc-500">{daySummary.dateLabel}</p>
          <p className="mt-1 text-lg font-semibold text-zinc-100">
            {daySummary.greeting}
          </p>
          {daySummary.bullets.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] text-zinc-400">Hoje você possui:</p>
              <ul className="mt-1.5 space-y-0.5">
                {daySummary.bullets.map((item) => (
                  <li key={item} className="text-[13px] text-zinc-300">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-zinc-500">
              Sua agenda está tranquila. Use as ações rápidas para começar o dia.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-zinc-500">
            {daySummary.nextEvent && (
              <span>
                Próximo:{" "}
                <span className="text-zinc-300">
                  {formatTime(daySummary.nextEvent.data_inicio)} —{" "}
                  {daySummary.nextEvent.titulo}
                </span>
              </span>
            )}
            {daySummary.topHabit && (
              <span>
                Hábito:{" "}
                <span className="text-zinc-300">{daySummary.topHabit.titulo}</span>
              </span>
            )}
            {daySummary.pendingMissionsCount > 0 && (
              <span>
                Missões:{" "}
                <span className="text-amber-400/90">
                  {daySummary.pendingMissionsCount} pendente(s)
                </span>
              </span>
            )}
          </div>
        </PanelContent>
      </Panel>

      {/* Seção 2 — KPIs */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Receita do mês"
          value={formatBRL(kpis.receitaMes)}
          hint={kpis.receitaMesLabel}
        />
        <MetricCard
          label="Leads ativos"
          value={String(kpis.leadsAtivos)}
          hint="Pipeline comercial"
        />
        <MetricCard
          label="Conteúdos pendentes"
          value={String(kpis.conteudosPendentes)}
          hint="Social Media"
        />
        <MetricCard
          label="Hábitos concluídos"
          value={
            kpis.habitosTotalHoje > 0
              ? `${kpis.habitosConcluidos}/${kpis.habitosTotalHoje}`
              : "0"
          }
          hint="Hoje"
        />
        <MetricCard
          label="Treinos da semana"
          value={String(kpis.treinosSemana)}
          hint="Saúde"
        />
        <MetricCard
          label="Eventos agendados"
          value={String(kpis.eventosAgendados)}
          hint="Próximos 30 dias"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Seção 3 — Prioridades */}
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Target className="size-3.5 text-violet-400" />
              Prioridades
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-1.5">
            {priorities.length === 0 ? (
              <EmptyState
                title="Nenhuma prioridade no momento"
                description="Cadastre leads, orçamentos ou conteúdos para ver sugestões automáticas."
              />
            ) : (
              priorities.map((item) => (
                <Link key={item.id} href={item.href} className="block">
                  <div className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-zinc-200">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-zinc-600">
                        {item.subtitle}
                      </p>
                    </div>
                    {item.kind === "lead" && (
                      <PriorityBadge
                        status={
                          growthLeads.find((l) => item.id === `lead-${l.id}`)
                            ?.status ?? "novo"
                        }
                      />
                    )}
                  </div>
                </Link>
              ))
            )}
          </PanelContent>
        </Panel>

        {/* Seção 4 — Agenda */}
        <Panel>
          <PanelHeader className="items-center">
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-sky-400" />
              Agenda
            </PanelTitle>
            <Link
              href="/dashboard/calendario"
              className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Ver calendário
            </Link>
          </PanelHeader>
          <PanelContent className="space-y-1">
            {agenda.length === 0 ? (
              <EmptyState
                title="Agenda livre"
                description="Nenhum compromisso nos próximos 14 dias."
                action={
                  <ActionButton onClick={() => setEventoModal(true)}>
                    Novo evento
                  </ActionButton>
                }
              />
            ) : (
              agenda.map((item) => (
                <Link key={item.id} href={item.href} className="block">
                  <div className="flex items-center gap-3 rounded-md border border-white/[0.04] px-2.5 py-2 transition-colors hover:bg-white/[0.03]">
                    <span className="w-12 shrink-0 text-[12px] font-medium tabular-nums text-violet-300">
                      {item.time}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-zinc-200">
                        {item.title}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-600">
                      {item.origem}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </PanelContent>
        </Panel>

        {/* Seção 5 — Feed da Aura */}
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-violet-400" />
              Feed da Aura
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {feedLoading ? (
              <div className="flex items-center gap-2 py-6 text-[13px] text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                Analisando seus dados...
              </div>
            ) : feedItems.length === 0 ? (
              <EmptyState
                title="Feed em preparação"
                description="Cadastre dados nos módulos para a Aura gerar insights personalizados."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {feedItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-white/[0.04] bg-white/[0.02] p-3"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-violet-400/80">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </PanelContent>
        </Panel>
      </div>

      {/* Seção 6 — Ações rápidas */}
      <Panel>
        <PanelHeader>
          <PanelTitle>Ações rápidas</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<Users className="size-3.5" />} onClick={() => setLeadModal(true)}>
              Novo Lead
            </ActionButton>
            <ActionButton
              icon={<CalendarPlus className="size-3.5" />}
              onClick={() => setEventoModal(true)}
            >
              Novo Evento
            </ActionButton>
            <ActionButton
              icon={<Clapperboard className="size-3.5" />}
              onClick={() => setConteudoModal(true)}
            >
              Novo Conteúdo
            </ActionButton>
            <ActionButton
              icon={<Dumbbell className="size-3.5" />}
              onClick={() => setTreinoModal(true)}
            >
              Novo Treino
            </ActionButton>
            <ActionButton
              icon={<UserPlus className="size-3.5" />}
              onClick={() => setClienteModal(true)}
            >
              Novo Cliente
            </ActionButton>
            <ActionButton icon={<Target className="size-3.5" />} onClick={() => setGoalModal(true)}>
              Nova Meta
            </ActionButton>
          </div>
        </PanelContent>
      </Panel>

      {/* Seção 7 — Estado vazio global */}
      {!dashboard.hasData && (
        <EmptyState
          title="Bem-vindo à Aura OS"
          description="Seu centro de comando está pronto. Comece cadastrando um lead, evento ou conteúdo usando as ações rápidas acima."
        />
      )}

      <AddGrowthLeadModal
        open={leadModal}
        onClose={() => setLeadModal(false)}
        onSubmit={handleCreateLead}
      />
      <AddEventoModal
        open={eventoModal}
        onClose={() => setEventoModal(false)}
        leads={growthLeads}
        onSubmit={async (payload) => {
          const result = await createEvento(payload);
          return { error: result.error };
        }}
      />
      <AddConteudoModal
        open={conteudoModal}
        onClose={() => setConteudoModal(false)}
        onSubmit={async (payload: ConteudoFormPayload) => {
          const result = await createConteudo(payload);
          return { error: result.error };
        }}
      />
      <AddHealthWorkoutModal
        open={treinoModal}
        onClose={() => setTreinoModal(false)}
        onSubmit={async (payload) => {
          const result = await createWorkout(payload);
          return { error: result.error };
        }}
      />
      <AddClienteModal
        open={clienteModal}
        onClose={() => setClienteModal(false)}
        onSubmit={async (payload) => {
          const result = await createCliente({
            ...payload,
            email: null,
            tipo: "pessoa_fisica",
          });
          return { error: result.error };
        }}
      />
      <SetGrowthGoalModal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        currentMeta={
          goals.find((g) => g.mes_referencia === getCurrentMonthReference())
            ?.meta_receita_mensal
        }
        onSubmit={handleSetGoal}
      />
    </div>
  );
}
