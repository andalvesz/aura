import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExecutionPlan } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ExecutionPlansRepository extends BaseRepository<"execution_plans"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "execution_plans", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("execution_plans")
      .select("*")
      .eq("user_id", this.userId)
      .order("plan_date", { ascending: false });

    return {
      data: (data as ExecutionPlan[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByDate(planDate: string) {
    const { data, error } = await this.supabase
      .from("execution_plans")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_date", planDate)
      .maybeSingle();

    return {
      data: (data as ExecutionPlan | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActiveForToday(today: string) {
    return this.findByDate(today);
  }
}
