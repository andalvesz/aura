import {
  FinancialGoalsRepository,
  FinancialIncomeRepository,
  GastosRepository,
} from "@/lib/supabase/repositories";
import type {
  FinancialGoal,
  FinancialIncome,
  FinancialIncomeOrigem,
  Gasto,
  Orcamento,
  TableInsert,
} from "@/types/database";
import { computeSmartFinanceStats, type SmartFinanceInput } from "@/utils/finance";
import { getDataContext } from "./context";
import { awardAuraXp } from "./xp.service";

export async function listFinancialGoals() {
  const { supabase, userId } = await getDataContext();
  return new FinancialGoalsRepository(supabase, userId).findAll("data_fim");
}

export async function createFinancialGoal(
  payload: Omit<TableInsert<"financial_goals">, "user_id" | "valor_atual">
) {
  const { supabase, userId } = await getDataContext();
  return new FinancialGoalsRepository(supabase, userId).create({
    ...payload,
    valor_atual: 0,
  });
}

export async function updateFinancialGoal(
  id: string,
  payload: Partial<Pick<FinancialGoal, "titulo" | "valor_meta" | "valor_atual" | "data_inicio" | "data_fim">>
) {
  const { supabase, userId } = await getDataContext();
  return new FinancialGoalsRepository(supabase, userId).update(id, payload);
}

export async function listFinancialIncome() {
  const { supabase, userId } = await getDataContext();
  return new FinancialIncomeRepository(supabase, userId).findAll("data");
}

export async function createFinancialIncome(
  payload: Omit<TableInsert<"financial_income">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  const result = await new FinancialIncomeRepository(supabase, userId).create(payload);
  if (!result.error && result.data) {
    await syncFinancialGoalsProgress(supabase, userId);
    await awardAuraXp("registrar_receita");
  }
  return result;
}

export async function syncFinancialGoalsProgress(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  userId: string
) {
  const goalsRepo = new FinancialGoalsRepository(supabase, userId);
  const incomeRepo = new FinancialIncomeRepository(supabase, userId);
  const { data: goals } = await goalsRepo.findAll("data_fim");
  if (!goals?.length) return;

  for (const goal of goals) {
    const { total } = await incomeRepo.sumInPeriod(goal.data_inicio, goal.data_fim);
    if (total !== Number(goal.valor_atual)) {
      await goalsRepo.update(goal.id, { valor_atual: total });
    }
  }
}

export async function syncAlveszIncomeFromOrcamento(orcamento: Orcamento): Promise<{
  created: boolean;
  error: string | null;
}> {
  if (orcamento.status !== "fechado") {
    return { created: false, error: null };
  }

  const { supabase, userId } = await getDataContext();
  const incomeRepo = new FinancialIncomeRepository(supabase, userId);

  const existing = await incomeRepo.findByOrcamentoId(orcamento.id);
  if (existing.data) {
    return { created: false, error: null };
  }

  const valor =
    Number(orcamento.lucro_estimado) > 0
      ? Number(orcamento.lucro_estimado)
      : Number(orcamento.valor_total);

  if (valor <= 0) {
    return { created: false, error: null };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await incomeRepo.create({
    descricao: `Orçamento Alvesz — ${orcamento.tipo_evento}`,
    valor,
    origem: "alvesz" satisfies FinancialIncomeOrigem,
    data: today,
    orcamento_id: orcamento.id,
  });

  if (error) {
    return { created: false, error };
  }

  await syncFinancialGoalsProgress(supabase, userId);
  return { created: true, error: null };
}

export async function loadSmartFinanceDashboard(): Promise<{
  stats: ReturnType<typeof computeSmartFinanceStats> | null;
  error: string | null;
}> {
  const { supabase, userId } = await getDataContext();

  const [gastosRes, incomeRes, goalsRes, balanceRes] = await Promise.all([
    new GastosRepository(supabase, userId).findAll("data"),
    new FinancialIncomeRepository(supabase, userId).findAll("data"),
    new FinancialGoalsRepository(supabase, userId).findAll("data_fim"),
    supabase
      .from("financial_balance")
      .select("valor_atual")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const error =
    gastosRes.error ?? incomeRes.error ?? goalsRes.error ?? balanceRes.error?.message ?? null;
  if (error) {
    return { stats: null, error };
  }

  const input: SmartFinanceInput = {
    gastos: (gastosRes.data ?? []) as Gasto[],
    income: (incomeRes.data ?? []) as FinancialIncome[],
    goals: (goalsRes.data ?? []) as FinancialGoal[],
    initialBalance:
      balanceRes.data?.valor_atual != null
        ? Number(balanceRes.data.valor_atual)
        : null,
  };

  return {
    stats: computeSmartFinanceStats(input),
    error: null,
  };
}
