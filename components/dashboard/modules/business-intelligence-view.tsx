"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  useAlveszEventos,
  useConteudos,
  useEventos,
  useFinancialBalance,
  useFinancialGoals,
  useFinancialIncome,
  useGastos,
  useGoals,
  useGrowthLeads,
  useGrowthMissions,
  useHealthHabits,
  useHealthMeals,
  useHealthSessions,
  useHealthWorkouts,
  useLeads,
  useOrcamentos,
} from "@/hooks";
import { cn } from "@/utils/cn";
import {
  BI_DOMAIN_LABELS,
  BI_KIND_LABELS,
  computeBiAnalysis,
  filterBiItemsByKind,
  type BiDomain,
  type BiItem,
  type BiItemKind,
} from "@/utils/business-intelligence";

const KIND_ICONS: Record<BiItemKind, typeof Lightbulb> = {
  insight: Lightbulb,
  oportunidade: TrendingUp,
  alerta: AlertTriangle,
  recomendacao: Target,
};

const KIND_STYLES: Record<BiItemKind, string> = {
  insight: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  oportunidade: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  alerta: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  recomendacao: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

const DOMAIN_ACCENTS: Record<BiDomain, string> = {
  leads: "text-cyan-400",
  eventos: "text-sky-400",
  conteudos: "text-amber-400",
  financas: "text-emerald-400",
  metas: "text-orange-400",
  saude: "text-rose-400",
};

function BiItemCard({ item }: { item: BiItem }) {
  const Icon = KIND_ICONS[item.kind];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border",
            KIND_STYLES[item.kind]
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[13px] font-medium text-zinc-100">{item.title}</p>
            <span className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500">
              {BI_DOMAIN_LABELS[item.domain]}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
            {item.description}
          </p>
          {item.href ? (
            <Link
              href={item.href}
              className="mt-2 inline-block text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Ver módulo →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BusinessIntelligenceView() {
  const { data: growthLeads, loading: growthLeadsLoading } = useGrowthLeads();
  const { data: consorcioLeads, loading: consorcioLeadsLoading } = useLeads();
  const { data: eventos, loading: eventosLoading } = useEventos();
  const { data: alveszEventos, loading: alveszEventosLoading } = useAlveszEventos();
  const { data: conteudos, loading: conteudosLoading } = useConteudos();
  const { data: gastos, loading: gastosLoading } = useGastos();
  const { data: financialIncome, loading: incomeLoading } = useFinancialIncome();
  const { data: financialGoals, loading: finGoalsLoading } = useFinancialGoals();
  const { data: financialBalance, loading: balanceLoading } = useFinancialBalance();
  const { data: goals, loading: goalsLoading } = useGoals();
  const { data: healthHabits, loading: habitsLoading } = useHealthHabits();
  const { data: healthWorkouts, loading: workoutsLoading } = useHealthWorkouts();
  const { data: healthMeals, loading: mealsLoading } = useHealthMeals();
  const { data: healthSessions, loading: sessionsLoading } = useHealthSessions();
  const { data: missions, loading: missionsLoading } = useGrowthMissions();
  const { data: orcamentos, loading: orcamentosLoading } = useOrcamentos();

  const [activeKind, setActiveKind] = useState<BiItemKind | "all">("all");

  const loading =
    growthLeadsLoading ||
    consorcioLeadsLoading ||
    eventosLoading ||
    alveszEventosLoading ||
    conteudosLoading ||
    gastosLoading ||
    incomeLoading ||
    finGoalsLoading ||
    balanceLoading ||
    goalsLoading ||
    habitsLoading ||
    workoutsLoading ||
    mealsLoading ||
    sessionsLoading ||
    missionsLoading ||
    orcamentosLoading;

  const analysis = useMemo(
    () =>
      computeBiAnalysis({
        growthLeads,
        consorcioLeads,
        eventos,
        alveszEventos,
        conteudos,
        gastos,
        financialIncome,
        financialGoals,
        financialBalance: financialBalance[0]?.valor_atual ?? null,
        goals,
        healthHabits,
        healthWorkouts,
        healthMeals,
        healthSessions,
        missions,
        orcamentos,
      }),
    [
      growthLeads,
      consorcioLeads,
      eventos,
      alveszEventos,
      conteudos,
      gastos,
      financialIncome,
      financialGoals,
      financialBalance,
      goals,
      healthHabits,
      healthWorkouts,
      healthMeals,
      healthSessions,
      missions,
      orcamentos,
    ]
  );

  const filteredItems =
    activeKind === "all"
      ? analysis.items
      : filterBiItemsByKind(analysis.items, activeKind);

  const kindFilters: { id: BiItemKind | "all"; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: analysis.items.length },
    {
      id: "insight",
      label: BI_KIND_LABELS.insight,
      count: analysis.summary.totalInsights,
    },
    {
      id: "oportunidade",
      label: BI_KIND_LABELS.oportunidade,
      count: analysis.summary.totalOportunidades,
    },
    {
      id: "alerta",
      label: BI_KIND_LABELS.alerta,
      count: analysis.summary.totalAlertas,
    },
    {
      id: "recomendacao",
      label: BI_KIND_LABELS.recomendacao,
      count: analysis.summary.totalRecomendacoes,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <MetricsSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!analysis.summary.hasData ? (
        <EmptyState
          title="Sem dados para análise"
          description="Cadastre leads, eventos, conteúdos, finanças, metas ou registros de saúde nos módulos da Aura."
        />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Insights"
          value={String(analysis.summary.totalInsights)}
          hint="Padrões detectados nos seus dados"
        />
        <MetricCard
          label="Oportunidades"
          value={String(analysis.summary.totalOportunidades)}
          hint="Ações com potencial de resultado"
          hintClassName="text-emerald-500/80"
        />
        <MetricCard
          label="Alertas"
          value={String(analysis.summary.totalAlertas)}
          hint="Situações que exigem atenção"
          hintClassName="text-rose-500/80"
        />
        <MetricCard
          label="Recomendações"
          value={String(analysis.summary.totalRecomendacoes)}
          hint="Próximos passos sugeridos"
          hintClassName="text-amber-500/80"
        />
      </div>

      <Panel className="border-violet-500/10 bg-violet-500/[0.02]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-400" />
            Perguntas estratégicas
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-3 pt-0 sm:grid-cols-3">
          <QuestionCard
            question="Onde devo focar?"
            answer={analysis.questions.ondeFocar}
          />
          <QuestionCard
            question="Qual oportunidade estou perdendo?"
            answer={analysis.questions.oportunidadePerdida}
          />
          <QuestionCard
            question="O que mais gera resultado?"
            answer={analysis.questions.oQueGeraResultado}
          />
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-400" />
            Prioridade por área
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-2 pt-0 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.domainScores.map((domain) => (
            <Link
              key={domain.domain}
              href={domain.href}
              className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 transition-colors hover:border-white/[0.1] hover:bg-zinc-900/60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-[13px] font-medium", DOMAIN_ACCENTS[domain.domain])}>
                  {domain.label}
                </p>
                <span className="text-[11px] text-zinc-500">score {domain.score}</span>
              </div>
              <p className="mt-1 text-[12px] text-zinc-500">{domain.reason}</p>
            </Link>
          ))}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelTitle>Análise detalhada</PanelTitle>
          <div className="flex flex-wrap gap-1.5">
            {kindFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveKind(filter.id)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] transition-colors",
                  activeKind === filter.id
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                    : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                )}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {filteredItems.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-zinc-500">
              Nenhum item nesta categoria.
            </p>
          ) : (
            filteredItems.map((item) => <BiItemCard key={item.id} item={item} />)
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}

function QuestionCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-violet-400/80">
        {question}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">{answer}</p>
    </div>
  );
}
