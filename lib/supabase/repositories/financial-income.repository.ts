import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinancialIncome } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class FinancialIncomeRepository extends BaseRepository<"financial_income"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "financial_income", userId);
  }

  async findByMonth(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;
    const { data, error } = await this.supabase
      .from("financial_income")
      .select("*")
      .eq("user_id", this.userId)
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: false });

    return { data: (data as FinancialIncome[]) ?? null, error: error?.message ?? null };
  }

  async findByOrcamentoId(orcamentoId: string) {
    const { data, error } = await this.supabase
      .from("financial_income")
      .select("*")
      .eq("user_id", this.userId)
      .eq("orcamento_id", orcamentoId)
      .maybeSingle();

    return { data: (data as FinancialIncome | null) ?? null, error: error?.message ?? null };
  }

  async sumInPeriod(start: string, end: string) {
    const { data, error } = await this.supabase
      .from("financial_income")
      .select("valor")
      .eq("user_id", this.userId)
      .gte("data", start)
      .lte("data", end);

    if (error) {
      return { total: 0, error: error.message };
    }

    const total = ((data as { valor: number }[]) ?? []).reduce(
      (s, row) => s + Number(row.valor),
      0
    );
    return { total, error: null };
  }
}
