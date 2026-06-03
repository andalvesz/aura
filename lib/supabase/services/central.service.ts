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
import { getOptionalDataContext, resolveUserDisplayName } from "./context";
import { loadExecutiveReportData } from "./reports.service";

function buildFinanceMentorContext(
  gastos: Gasto[],
  income: FinancialIncome[],
  goals: FinancialGoal[],
  initialBalance?: number | null
): string {
  const stats = computeSmartFinanceStats({ gastos, income, goals, initialBalance });
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

  const saldoLine = stats.hasInitialBalance
    ? `* Saldo atual: ${formatBRL(stats.saldoAtual ?? 0)} (base ${formatBRL(stats.initialBalance ?? 0)})`
    : "* Saldo atual: não definido — peça para definir o saldo inicial";
  const projecaoLine = stats.hasInitialBalance
    ? `* Previsão fim do mês: ${formatBRL(stats.projectedSaldo ?? 0)}`
    : "* Previsão fim do mês: indisponível sem saldo inicial";

  return `## FINANCEIRO — CONTEXTO PARA AURA CENTRAL

### Resumo do mês
* Receitas: ${formatBRL(stats.totalIncomeMonth)}
* Gastos: ${formatBRL(stats.totalMonth)}
${saldoLine}
${projecaoLine}

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
  const ctx = await getOptionalDataContext();
  const { data, error } = await loadExecutiveReportData();
  if (error || !data) {
    return { summary: null, error };
  }

  const displayName = ctx ? await resolveUserDisplayName(ctx) : "você";

  return {
    summary: buildAuraCentralOpeningSummary(data, displayName),
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
    const [gastosRes, incomeRes, goalsRes, balanceRes] = await Promise.all([
      new GastosRepository(ctx.supabase, ctx.userId).findAll("data"),
      new FinancialIncomeRepository(ctx.supabase, ctx.userId).findAll("data"),
      new FinancialGoalsRepository(ctx.supabase, ctx.userId).findAll("data_fim"),
      ctx.supabase
        .from("financial_balance")
        .select("valor_atual")
        .eq("user_id", ctx.userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const error =
      gastosRes.error ??
      incomeRes.error ??
      goalsRes.error ??
      balanceRes.error?.message ??
      null;
    if (error && !isMissingSupabaseTableError(error)) {
      return { context: null, error };
    }

    const initialBalance = balanceRes.data?.valor_atual ?? null;

    return {
      context: buildFinanceMentorContext(
        (gastosRes.data ?? []) as Gasto[],
        (incomeRes.data ?? []) as FinancialIncome[],
        (goalsRes.data ?? []) as FinancialGoal[],
        initialBalance != null ? Number(initialBalance) : null
      ),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { context: null, error: message };
  }
}
