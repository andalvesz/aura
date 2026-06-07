"use client";

import Link from "next/link";
import { Sparkles, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardUser } from "@/components/dashboard/dashboard-user-context";
import { MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  useClientes,
  useEventos,
  useFinancialBalance,
  useFinancialGoals,
  useFinancialIncome,
  useGastos,
  useGoals,
  useGrowthLeads,
  useHealthHabits,
  useHealthWorkouts,
  useOrcamentos,
} from "@/hooks";
import { cn } from "@/utils/cn";
import {
  buildCoachNowResponse,
  buildDailySummary,
  buildDailyTopPriorities,
  hasDailyOperationsData,
} from "@/utils/daily-operations";
import { formatExecutiveDateLabel, getExecutiveGreeting } from "@/utils/executive";
import type { OrcamentoWithCliente } from "@/utils/nexus";

export function DailyOperationsPanel() {
  const { displayName } = useDashboardUser();
  const { data: eventos, loading: eventosLoading } = useEventos();
  const { data: growthLeads, loading: leadsLoading } = useGrowthLeads();
  const { data: orcamentos, loading: orcamentosLoading } = useOrcamentos();
  const { data: clientes, loading: clientesLoading } = useClientes();
  const { data: gastos, loading: gastosLoading } = useGastos();
  const { data: financialIncome, loading: incomeLoading } = useFinancialIncome();
  const { data: financialGoals, loading: finGoalsLoading } = useFinancialGoals();
  const { data: financialBalance, loading: balanceLoading } = useFinancialBalance();
  const { data: goals, loading: goalsLoading } = useGoals();
  const { data: healthHabits, loading: habitsLoading } = useHealthHabits();
  const { data: healthWorkouts, loading: workoutsLoading } = useHealthWorkouts();

  const [coachOpen, setCoachOpen] = useState(false);

  const loading =
    eventosLoading ||
    leadsLoading ||
    orcamentosLoading ||
    clientesLoading ||
    gastosLoading ||
    incomeLoading ||
    finGoalsLoading ||
    balanceLoading ||
    goalsLoading ||
    habitsLoading ||
    workoutsLoading;

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

  const input = useMemo(
    () => ({
      eventos,
      growthLeads,
      orcamentos: orcamentosWithClientes,
      gastos,
      financialIncome,
      financialGoals,
      financialBalance: financialBalance[0]?.valor_atual ?? null,
      goals,
      healthHabits,
      healthWorkouts,
    }),
    [
      eventos,
      growthLeads,
      orcamentosWithClientes,
      gastos,
      financialIncome,
      financialGoals,
      financialBalance,
      goals,
      healthHabits,
      healthWorkouts,
    ]
  );

  const summary = useMemo(() => buildDailySummary(input), [input]);
  const priorities = useMemo(() => buildDailyTopPriorities(input), [input]);
  const coachAnswer = useMemo(
    () => buildCoachNowResponse(input, displayName),
    [input, displayName]
  );
  const hasData = useMemo(() => hasDailyOperationsData(input), [input]);

  if (loading) {
    return (
      <Panel className="border-amber-500/10 bg-amber-500/[0.02]">
        <PanelContent className="py-4">
          <MetricsSkeleton count={3} />
        </PanelContent>
      </Panel>
    );
  }

  return (
    <Panel className="border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-violet-500/[0.04]">
      <PanelHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <PanelTitle className="flex items-center gap-2">
          <Sun className="size-4 text-amber-400" />
          Operação do Dia
        </PanelTitle>
        <p className="text-[11px] text-zinc-500">{formatExecutiveDateLabel()}</p>
      </PanelHeader>
      <PanelContent className="space-y-4 pt-0">
        <div>
          <p className="text-lg font-semibold text-zinc-100">
            {getExecutiveGreeting(displayName)}
          </p>
          <p className="mt-1 text-[13px] text-zinc-500">
            Central de operações diárias — o que fazer hoje com dados reais.
          </p>
        </div>

        {!hasData ? (
          <p className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-3 py-4 text-[13px] text-zinc-500">
            Cadastre eventos, leads, orçamentos, finanças, hábitos ou metas para montar seu
            plano do dia.
          </p>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Resumo do dia
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.map((section) => (
                <Link
                  key={section.id}
                  href={section.href}
                  className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3 transition-colors hover:border-white/[0.1] hover:bg-zinc-900/60"
                >
                  <p className="text-[13px] font-medium text-zinc-200">
                    {section.emoji} {section.label}
                  </p>
                  {section.lines.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {section.lines.slice(0, 3).map((line) => (
                        <li key={line} className="text-[12px] leading-snug text-zinc-500">
                          · {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[12px] text-zinc-600">{section.emptyHint}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-violet-400/80">
                Prioridades
              </p>
              <ol className="mt-2 space-y-2">
                {priorities.map((item) => (
                  <li key={item.rank} className="flex gap-2 text-[13px] text-zinc-300">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-300">
                      {item.rank}
                    </span>
                    {item.href ? (
                      <Link href={item.href} className="hover:text-zinc-100">
                        {item.text}
                      </Link>
                    ) : (
                      <span>{item.text}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-zinc-900/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-200">
                  <Sparkles className="size-3.5 text-amber-400" />
                  Aura Coach
                </p>
                <button
                  type="button"
                  onClick={() => setCoachOpen((v) => !v)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    coachOpen
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                      : "border-white/[0.08] text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  O que devo fazer agora?
                </button>
              </div>
              {coachOpen ? (
                <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">
                  {coachAnswer}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-zinc-600">
                  Resposta instantânea com base nos seus dados de hoje.
                </p>
              )}
            </div>
          </div>
        </div>
      </PanelContent>
    </Panel>
  );
}
