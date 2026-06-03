"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinancialBalance } from "./use-financial-balance";
import { useFinancialGoals } from "./use-financial-goals";
import { useFinancialIncome } from "./use-financial-income";
import { useGastos } from "./use-gastos";
import { computeSmartFinanceStats } from "@/utils/finance";

/**
 * Agrega os 4 hooks do Financeiro com loading inicial estável (sem skeleton infinito).
 */
export function useFinanceiro() {
  const {
    data: gastos,
    loading: loadingGastos,
    error: gastosError,
    create: createGasto,
  } = useGastos();
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

  const queriesLoading =
    loadingGastos || loadingIncome || loadingGoals || loadingBalance;

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (!queriesLoading) {
      setInitialLoadComplete(true);
    }
  }, [queriesLoading]);

  const showSkeleton = !initialLoadComplete;

  const currentBalance = balances[0] ?? null;

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

  const financeDataError =
    gastosError || incomeError || goalsError || balanceError;

  return {
    gastos,
    income,
    goals,
    balances,
    currentBalance,
    stats,
    showSkeleton,
    initialLoadComplete,
    financeDataError,
    errors: {
      gastos: gastosError,
      income: incomeError,
      goals: goalsError,
      balance: balanceError,
    },
    createGasto,
    createIncome,
    createGoal,
    createBalance,
    updateBalance,
    refreshIncome,
    refreshGoals,
    refreshBalance,
  };
}
