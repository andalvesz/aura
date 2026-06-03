import { GastosRepository } from "@/lib/supabase/repositories";
import type { Gasto } from "@/types/database";
import {
  ORCAMENTO_MENSAL,
  computeFinanceStats,
  getCategoryLabel,
} from "@/utils/finance";
import { formatBRL } from "@/utils/format";
import { buildAuraCentralOpeningSummary } from "@/utils/orchestrator";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";
import { loadAuraGlobalSummaryData } from "./mentor.service";

function buildFinanceMentorContext(gastos: Gasto[]): string {
  const stats = computeFinanceStats(gastos);
  const recentLines =
    stats.monthGastos.length > 0
      ? stats.monthGastos
          .slice(0, 8)
          .map(
            (g) =>
              `* ${g.titulo} — ${formatBRL(Number(g.valor))} (${getCategoryLabel(g.categoria)}) — ${g.data}`
          )
          .join("\n")
      : "* Nenhum gasto registrado no mês";

  return `## FINANCEIRO — CONTEXTO PARA AURA CENTRAL

### Resumo do mês
* Total gasto: ${formatBRL(stats.totalMonth)}
* Orçamento mensal: ${formatBRL(ORCAMENTO_MENSAL)}
* Saldo restante: ${formatBRL(stats.saldo)}
* Previsão do mês: ${formatBRL(stats.forecast)}
* Maior categoria: ${stats.topCategory?.label ?? "N/A"} (${stats.topCategory?.pct ?? 0}%)

### Gastos recentes
${recentLines}

Analise os gastos, identifique padrões e sugira ações práticas para Anderson Alves.`;
}

export async function getAuraCentralOpeningSummary(): Promise<{
  summary: ReturnType<typeof buildAuraCentralOpeningSummary> | null;
  error: string | null;
}> {
  const { data, error } = await loadAuraGlobalSummaryData();
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
    const { data, error } = await new GastosRepository(
      ctx.supabase,
      ctx.userId
    ).findAll("data");

    if (error && !isMissingSupabaseTableError(error)) {
      return { context: null, error };
    }

    return {
      context: buildFinanceMentorContext((data ?? []) as Gasto[]),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { context: null, error: message };
  }
}
