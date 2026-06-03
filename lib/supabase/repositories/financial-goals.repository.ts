import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FinancialGoal } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class FinancialGoalsRepository extends BaseRepository<"financial_goals"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "financial_goals", userId);
  }

  async findActive(referenceDate: string) {
    const { data, error } = await this.supabase
      .from("financial_goals")
      .select("*")
      .eq("user_id", this.userId)
      .lte("data_inicio", referenceDate)
      .gte("data_fim", referenceDate)
      .order("data_fim", { ascending: true });

    return { data: (data as FinancialGoal[]) ?? null, error: error?.message ?? null };
  }
}
