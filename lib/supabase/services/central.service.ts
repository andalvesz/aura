import {
  FinancialGoalsRepository,
  FinancialIncomeRepository,
  GastosRepository,
} from "@/lib/supabase/repositories";
import type { FinancialGoal, FinancialIncome, Gasto } from "@/types/database";
import {
  buildFinanceNextActions,
  computeSmartFinanceStats,
  getCategoryLabel,
  getIncomeOrigemLabel,
} from "@/utils/finance";
import { formatBRL } from "@/utils/format";
import { buildAuraCentralOpeningSummary } from "@/utils/orchestrator";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";
import { loadExecutiveReportData } from "./reports.service";

function buildFinanceMentorContext(
  gastos: Gasto[],
  income: FinancialIncome[],
  goals: FinancialGoal[]
): string {
  const stats = computeSmartFinanceStats({ gastos, income, goals });
  const actions = buildFinanceNextActions(stats);

  const recentExpenseLines =
    stats.monthGastos.length > 0
      ? stats.monthGastos
          .slice(0, 6)
          .map(
            (g) =>
              `* ${g.titulo} — ${formatBRL(Number(g.valor))} (${getCategoryLabel(g.categoria)})`
          )
          .join("\n")
      : "* Nenhuma despesa no mês";

  const recentIncomeLines =
    stats.monthIncome.length > 0
      ? stats.monthIncome
          .slice(0, 6)
          .map(
            (i) =>
              `* ${i.descricao} — ${formatBRL(Number(i.valor))} (${getIncomeOrigemLabel(i.origem)})`
          )
          .join("\n")
      : "* Nenhuma receita no mês";

  const metaBlock = stats.activeGoal
    ? `* Meta: ${stats.activeGoal.titulo}
* Progresso: ${stats.goalProgress?.pct ?? 0}% (${formatBRL(stats.goalProgress?.atual ?? 0)} de ${formatBRL(stats.goalProgress?.meta ?? 0)})`
    : "* Meta: nenhuma meta ativa no período";

  return `## FINANCEIRO — CONTEXTO PARA AURA CENTRAL

### Resumo do mês
* Receitas: ${formatBRL(stats.totalIncomeMonth)}
* Despesas: ${formatBRL(stats.totalMonth)}
* Saldo: ${formatBRL(stats.saldo)}
* Projeção saldo fim do mês: ${formatBRL(stats.projectedSaldo)}

### Meta
${metaBlock}

### Receitas recentes
${recentIncomeLines}

### Despesas recentes
${recentExpenseLines}

### Próximas ações sugeridas
${actions.map((a) => `* ${a}`).join("\n")}

Responda com receitas, despesas, saldo, meta e próximas ações práticas para Anderson Alves.`;
}

export async function getAuraCentralOpeningSummary(): Promise<{
  summary: ReturnType<typeof buildAuraCentralOpeningSummary> | null;
  error: string | null;
}> {
  const { data, error } = await loadExecutiveReportData();
  if (error || !data) {
    return { summary: null, error };
  }

  return {
    summary: buildAuraCentralOpeningSummary(data),
    error: null,
  };
}

export async function getAuraCentralFinanceContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  try {
    const [gastosRes, incomeRes, goalsRes] = await Promise.all([
      new GastosRepository(ctx.supabase, ctx.userId).findAll("data"),
      new FinancialIncomeRepository(ctx.supabase, ctx.userId).findAll("data"),
      new FinancialGoalsRepository(ctx.supabase, ctx.userId).findAll("data_fim"),
    ]);

    const error = gastosRes.error ?? incomeRes.error ?? goalsRes.error;
    if (error && !isMissingSupabaseTableError(error)) {
      return { context: null, error };
    }

    return {
      context: buildFinanceMentorContext(
        (gastosRes.data ?? []) as Gasto[],
        (incomeRes.data ?? []) as FinancialIncome[],
        (goalsRes.data ?? []) as FinancialGoal[]
      ),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { context: null, error: message };
  }
}
