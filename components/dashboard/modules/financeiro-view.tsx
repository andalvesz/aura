"use client";

import { Plus, Target, TrendingUp, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { useFinancialBalance } from "@/hooks/use-financial-balance";
import { useFinancialGoals } from "@/hooks/use-financial-goals";
import { useFinancialIncome } from "@/hooks/use-financial-income";
import { useGastos } from "@/hooks/use-gastos";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDate } from "@/utils/format";
import {
  computeSmartFinanceStats,
  getCategoryLabel,
  getIncomeOrigemLabel,
} from "@/utils/finance";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddGastoModal } from "./add-gasto-modal";
import { AddMetaFinanceiraModal } from "./add-meta-financeira-modal";
import { AddReceitaModal } from "./add-receita-modal";
import { SetSaldoInicialModal } from "./set-saldo-inicial-modal";

async function syncGoalsProgress() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: goals } = await supabase
    .from("financial_goals")
    .select("id, data_inicio, data_fim, valor_atual")
    .eq("user_id", user.id);

  if (!goals?.length) return;

  for (const goal of goals) {
    const { data: incomes } = await supabase
      .from("financial_income")
      .select("valor")
      .eq("user_id", user.id)
      .gte("data", goal.data_inicio)
      .lte("data", goal.data_fim);

    const total = (incomes ?? []).reduce((s, row) => s + Number(row.valor), 0);
    if (total !== Number(goal.valor_atual)) {
      await supabase
        .from("financial_goals")
        .update({ valor_atual: total })
        .eq("id", goal.id)
        .eq("user_id", user.id);
    }
  }
}

export function FinanceiroView() {
  const { data: gastos, loading: loadingGastos, error: gastosError, create: createGasto } =
    useGastos();
  const {
    data: income,
    loading: loadingIncome,
    error: incomeError,
    create: createIncome,
    refresh: refreshIncome,
  } = useFinancialIncome();
  const {
    data: goals,
    loading: loadingGoals,
    error: goalsError,
    create: createGoal,
    refresh: refreshGoals,
  } = useFinancialGoals();
  const {
    data: balances,
    loading: loadingBalance,
    error: balanceError,
    create: createBalance,
    update: updateBalance,
    refresh: refreshBalance,
  } = useFinancialBalance();

  const [gastoModalOpen, setGastoModalOpen] = useState(false);
  const [receitaModalOpen, setReceitaModalOpen] = useState(false);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);

  const currentBalance = balances[0] ?? null;
  const loading = loadingGastos || loadingIncome || loadingGoals || loadingBalance;

  const stats = useMemo(
    () =>
      computeSmartFinanceStats({
        gastos,
        income,
        goals,
        initialBalance: currentBalance?.valor_atual ?? null,
      }),
    [gastos, income, goals, currentBalance?.valor_atual]
  );

  const refreshFinance = useCallback(async () => {
    await syncGoalsProgress();
    await Promise.all([refreshIncome(), refreshGoals(), refreshBalance()]);
  }, [refreshIncome, refreshGoals, refreshBalance]);

  async function handleSetInitialBalance(valor: number) {
    if (currentBalance) {
      return updateBalance(currentBalance.id, { valor_atual: valor });
    }
    return createBalance({ valor_atual: valor });
  }

  useEffect(() => {
    if (!loadingIncome && !loadingGoals && !loadingBalance) {
      void refreshFinance();
    }
  }, [loadingIncome, loadingGoals, loadingBalance, refreshFinance]);

  useEffect(() => {
    if (gastosError) toast.error(gastosError);
    if (incomeError) toast.error(incomeError);
    if (goalsError) toast.error(goalsError);
    if (balanceError) toast.error(balanceError);
  }, [gastosError, incomeError, goalsError, balanceError]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton
          icon={<Wallet className="size-3.5" />}
          onClick={() => setSaldoModalOpen(true)}
        >
          Definir saldo inicial
        </ActionButton>
        <ActionButton
          icon={<TrendingUp className="size-3.5" />}
          onClick={() => setReceitaModalOpen(true)}
        >
          Receita
        </ActionButton>
        <ActionButton
          icon={<Target className="size-3.5" />}
          onClick={() => setMetaModalOpen(true)}
        >
          Meta
        </ActionButton>
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setGastoModalOpen(true)}
        >
          Despesa
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricCard
            label="Saldo atual"
            value={
              stats.hasInitialBalance
                ? formatBRL(stats.saldoAtual ?? 0)
                : "Defina seu saldo inicial"
            }
            hint={
              stats.hasInitialBalance
                ? `Base ${formatBRL(stats.initialBalance ?? 0)} + movimentação do mês`
                : "Informe quanto você tem hoje"
            }
            hintClassName={
              stats.hasInitialBalance
                ? (stats.saldoAtual ?? 0) >= 0
                  ? "text-emerald-400/90"
                  : "text-red-400/90"
                : undefined
            }
          />
          <MetricCard
            label="Gastos do mês"
            value={formatBRL(stats.totalMonth)}
            hint={`Dia ${stats.dayOfMonth} de ${stats.daysInMonth}`}
          />
          <MetricCard
            label="Receitas do mês"
            value={formatBRL(stats.totalIncomeMonth)}
            hintClassName="text-emerald-400/90"
          />
          <MetricCard
            label="Previsão do mês"
            value={
              stats.hasInitialBalance
                ? formatBRL(stats.projectedSaldo ?? 0)
                : "Defina seu saldo inicial"
            }
            hint={
              stats.hasInitialBalance
                ? "Saldo estimado no fim do mês"
                : "Disponível após definir o saldo"
            }
          />
        </div>
      )}

      {stats.activeGoal && !loading && (
        <Panel>
          <PanelHeader>
            <PanelTitle>{stats.activeGoal.titulo}</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2 pt-0">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>
                {formatBRL(stats.goalProgress?.atual ?? 0)} de{" "}
                {formatBRL(stats.goalProgress?.meta ?? 0)}
              </span>
              <span>{stats.goalProgress?.pct ?? 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-500/70 transition-all duration-500"
                style={{ width: `${stats.goalProgress?.pct ?? 0}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600">
              {formatDate(stats.activeGoal.data_inicio)} —{" "}
              {formatDate(stats.activeGoal.data_fim)}
            </p>
          </PanelContent>
        </Panel>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Receitas recentes</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : stats.monthIncome.length === 0 ? (
              <EmptyState
                title="Nenhuma receita este mês"
                description="Registre entradas de Alvesz, consórcios, salário ou freelance."
                action={
                  <ActionButton onClick={() => setReceitaModalOpen(true)}>
                    Registrar receita
                  </ActionButton>
                }
              />
            ) : (
              <ul className="space-y-0.5">
                {stats.monthIncome.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="text-[13px] text-zinc-200">{i.descricao}</p>
                      <p className="text-[11px] text-zinc-600">
                        {getIncomeOrigemLabel(i.origem)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-emerald-300/90">
                        {formatBRL(Number(i.valor))}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {formatDate(i.data)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Despesas recentes</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {loading ? (
              <ListSkeleton />
            ) : stats.monthGastos.length === 0 ? (
              <EmptyState
                title="Nenhuma despesa este mês"
                description="Adicione gastos para acompanhar o fluxo de caixa."
                action={
                  <ActionButton onClick={() => setGastoModalOpen(true)}>
                    Adicionar despesa
                  </ActionButton>
                }
              />
            ) : (
              <ul className="space-y-0.5">
                {stats.monthGastos.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <div>
                      <p className="text-[13px] text-zinc-200">{g.titulo}</p>
                      <p className="text-[11px] text-zinc-600">
                        {getCategoryLabel(g.categoria)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-medium text-zinc-200">
                        {formatBRL(Number(g.valor))}
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        {formatDate(g.data)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Por categoria (despesas)</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2.5 pt-0">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : stats.categories.length === 0 ? (
            <EmptyState title="Sem categorias" description="Adicione despesas para ver o gráfico." />
          ) : (
            stats.categories.map((c) => (
              <div key={c.key}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-zinc-400">{c.label}</span>
                  <span className="text-zinc-600">{c.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${c.color}/70 transition-all duration-500`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <AddGastoModal
        open={gastoModalOpen}
        onClose={() => setGastoModalOpen(false)}
        onSubmit={async (payload) => {
          const { error } = await createGasto(payload);
          return { error };
        }}
      />
      <AddReceitaModal
        open={receitaModalOpen}
        onClose={() => setReceitaModalOpen(false)}
        onSubmit={async (payload) => {
          const { error } = await createIncome(payload);
          if (!error) await refreshFinance();
          return { error };
        }}
      />
      <AddMetaFinanceiraModal
        open={metaModalOpen}
        onClose={() => setMetaModalOpen(false)}
        onSubmit={async (payload) => {
          const { error } = await createGoal({ ...payload, valor_atual: 0 });
          if (!error) await refreshFinance();
          return { error };
        }}
      />
      <SetSaldoInicialModal
        open={saldoModalOpen}
        onClose={() => setSaldoModalOpen(false)}
        currentValue={currentBalance?.valor_atual}
        onSubmit={async (valor) => {
          const { error } = await handleSetInitialBalance(valor);
          if (!error) await refreshBalance();
          return { error };
        }}
      />
    </div>
  );
}
