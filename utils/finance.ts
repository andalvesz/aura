import type { FinancialGoal, FinancialIncome, Gasto } from "@/types/database";

export const GASTO_CATEGORIAS = [
  { value: "alimentacao", label: "Alimentação", color: "bg-emerald-500" },
  { value: "transporte", label: "Transporte", color: "bg-sky-500" },
  { value: "saude", label: "Saúde", color: "bg-rose-500" },
  { value: "lazer", label: "Lazer", color: "bg-violet-500" },
  { value: "equipamentos", label: "Equipamentos", color: "bg-amber-500" },
  { value: "empresa", label: "Empresa", color: "bg-orange-500" },
  { value: "outros", label: "Outros", color: "bg-zinc-500" },
] as const;

export const INCOME_ORIGENS = [
  { value: "alvesz", label: "Alvesz" },
  { value: "consorcios", label: "Consórcios" },
  { value: "salario", label: "Salário" },
  { value: "freelance", label: "Freelance" },
  { value: "outros", label: "Outros" },
] as const;

export function getCategoryLabel(value: string) {
  return GASTO_CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

export function getCategoryColor(value: string) {
  return GASTO_CATEGORIAS.find((c) => c.value === value)?.color ?? "bg-zinc-500";
}

export function getIncomeOrigemLabel(value: string) {
  return INCOME_ORIGENS.find((o) => o.value === value)?.label ?? value;
}

function parseLocalDate(isoDate: string) {
  return new Date(isoDate + "T12:00:00");
}

export function filterByCurrentMonth<T extends { data: string }>(rows: T[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return rows.filter((row) => {
    const d = parseLocalDate(row.data);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function filterGastosCurrentMonth(gastos: Gasto[]) {
  return filterByCurrentMonth(gastos);
}

export function filterIncomeCurrentMonth(income: FinancialIncome[]) {
  return filterByCurrentMonth(income);
}

export function getActiveFinancialGoal(
  goals: FinancialGoal[],
  referenceDate = new Date().toISOString().slice(0, 10)
): FinancialGoal | null {
  const active = goals.filter(
    (g) => g.data_inicio <= referenceDate && g.data_fim >= referenceDate
  );
  if (active.length === 0) return null;
  return active.sort((a, b) => a.data_fim.localeCompare(b.data_fim))[0];
}

export function computeGoalProgress(goal: FinancialGoal) {
  const meta = Number(goal.valor_meta);
  const atual = Number(goal.valor_atual);
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  return { meta, atual, pct, remaining: Math.max(0, meta - atual) };
}

export function isGoalBehind(goal: FinancialGoal, today = new Date()) {
  const start = parseLocalDate(goal.data_inicio);
  const end = parseLocalDate(goal.data_fim);
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const elapsedDays = Math.max(
    0,
    Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const timePct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const { pct } = computeGoalProgress(goal);
  const todayIso = today.toISOString().slice(0, 10);

  if (goal.data_fim < todayIso && pct < 100) return true;
  return timePct >= 50 && pct < timePct - 10;
}

export function isGoalReached(goal: FinancialGoal) {
  return Number(goal.valor_atual) >= Number(goal.valor_meta);
}

export type SmartFinanceInput = {
  gastos: Gasto[];
  income: FinancialIncome[];
  goals: FinancialGoal[];
  /** Saldo informado pelo usuário (financial_balance.valor_atual) */
  initialBalance?: number | null;
};

export function computeFinanceStats(gastos: Gasto[]) {
  const monthGastos = filterGastosCurrentMonth(gastos);
  const totalMonth = monthGastos.reduce((s, g) => s + Number(g.valor), 0);

  const byCategory = new Map<string, number>();
  monthGastos.forEach((g) => {
    byCategory.set(g.categoria, (byCategory.get(g.categoria) ?? 0) + Number(g.valor));
  });

  const categories = Array.from(byCategory.entries())
    .map(([key, total]) => ({
      key,
      label: getCategoryLabel(key),
      total,
      pct: totalMonth > 0 ? Math.round((total / totalMonth) * 100) : 0,
      color: getCategoryColor(key),
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = categories[0];

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? totalMonth / dayOfMonth : 0;
  const forecast = dailyAvg * daysInMonth;

  return {
    monthGastos,
    totalMonth,
    categories,
    topCategory,
    forecast,
    dayOfMonth,
    daysInMonth,
  };
}

function averageMonthlyExpenses(gastos: Gasto[], monthsBack = 3) {
  const now = new Date();
  const totals: number[] = [];

  for (let i = 1; i <= monthsBack; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthTotal = gastos
      .filter((g) => {
        const gd = parseLocalDate(g.data);
        return gd.getFullYear() === y && gd.getMonth() === m;
      })
      .reduce((s, g) => s + Number(g.valor), 0);
    if (monthTotal > 0) totals.push(monthTotal);
  }

  if (totals.length === 0) return 0;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

export function detectUnusualExpense(
  gastos: Gasto[],
  totalMonth: number
): { unusual: boolean; avgPrevious: number } {
  const avgPrevious = averageMonthlyExpenses(gastos);
  if (avgPrevious <= 0 || totalMonth <= 0) {
    return { unusual: false, avgPrevious };
  }
  return { unusual: totalMonth > avgPrevious * 1.3, avgPrevious };
}

export function computeSmartFinanceStats(input: SmartFinanceInput) {
  const expenseStats = computeFinanceStats(input.gastos);
  const monthIncome = filterIncomeCurrentMonth(input.income);
  const totalIncomeMonth = monthIncome.reduce((s, i) => s + Number(i.valor), 0);

  const hasInitialBalance =
    input.initialBalance != null && !Number.isNaN(Number(input.initialBalance));
  const baseBalance = hasInitialBalance ? Number(input.initialBalance) : 0;
  const saldoAtual = hasInitialBalance
    ? baseBalance + totalIncomeMonth - expenseStats.totalMonth
    : null;

  const activeGoal = getActiveFinancialGoal(input.goals);
  const goalProgress = activeGoal ? computeGoalProgress(activeGoal) : null;

  const incomeDailyAvg =
    expenseStats.dayOfMonth > 0 ? totalIncomeMonth / expenseStats.dayOfMonth : 0;
  const expenseDailyAvg =
    expenseStats.dayOfMonth > 0
      ? expenseStats.totalMonth / expenseStats.dayOfMonth
      : 0;
  const projectedIncome = incomeDailyAvg * expenseStats.daysInMonth;
  const projectedExpenses = expenseDailyAvg * expenseStats.daysInMonth;
  const projectedSaldo = hasInitialBalance
    ? baseBalance + projectedIncome - projectedExpenses
    : null;

  const expenseAlert = detectUnusualExpense(
    input.gastos,
    expenseStats.totalMonth
  );

  return {
    ...expenseStats,
    monthIncome,
    totalIncomeMonth,
    hasInitialBalance,
    initialBalance: hasInitialBalance ? baseBalance : null,
    saldoAtual,
    /** @deprecated Use saldoAtual — mantido para compatibilidade interna */
    saldo: saldoAtual ?? 0,
    activeGoal,
    goalProgress,
    projectedIncome,
    projectedExpenses,
    projectedSaldo,
    expenseAlert,
  };
}

export function buildFinanceNextActions(stats: ReturnType<typeof computeSmartFinanceStats>) {
  const actions: string[] = [];

  if (stats.activeGoal && stats.goalProgress) {
    if (isGoalBehind(stats.activeGoal)) {
      actions.push(
        `Meta "${stats.activeGoal.titulo}" atrasada — faltam R$ ${stats.goalProgress.remaining.toFixed(0)} para o objetivo.`
      );
    } else if (stats.goalProgress.pct >= 100) {
      actions.push(`Meta "${stats.activeGoal.titulo}" atingida. Defina a próxima meta.`);
    } else {
      actions.push(
        `Continue na meta "${stats.activeGoal.titulo}" (${stats.goalProgress.pct}% concluído).`
      );
    }
  } else {
    actions.push("Defina uma meta financeira no módulo Financeiro.");
  }

  if (stats.expenseAlert.unusual) {
    actions.push("Despesas do mês acima da sua média recente — revise categorias.");
  }

  if (!stats.hasInitialBalance) {
    actions.push("Defina seu saldo inicial no módulo Financeiro.");
  } else if ((stats.saldoAtual ?? 0) < 0) {
    actions.push("Saldo negativo — reduza despesas ou registre novas receitas.");
  } else if (stats.totalIncomeMonth === 0 && stats.totalMonth > 0) {
    actions.push("Registre receitas (salário, Alvesz, consórcios) para acompanhar entradas.");
  }

  if (stats.topCategory && stats.topCategory.pct >= 40) {
    actions.push(`Maior gasto: ${stats.topCategory.label} (${stats.topCategory.pct}% do mês).`);
  }

  return actions.slice(0, 4);
}
