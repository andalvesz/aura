import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Goal } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class GoalsRepository extends BaseRepository<"goals"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "goals", userId);
  }

  async findActive(referenceDate: string) {
    const { data, error } = await this.supabase
      .from("goals")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "ativa")
      .lte("data_inicio", referenceDate)
      .gte("data_fim", referenceDate)
      .order("data_fim", { ascending: true });

    return { data: (data as Goal[]) ?? null, error: error?.message ?? null };
  }
}
