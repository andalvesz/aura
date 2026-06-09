import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MoneyMissionPlan } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class MoneyMissionPlansRepository extends BaseRepository<"money_mission_plans"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "money_mission_plans", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("money_mission_plans")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as MoneyMissionPlan[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActive() {
    const { data, error } = await this.supabase
      .from("money_mission_plans")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as MoneyMissionPlan | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async archiveActive() {
    const { error } = await this.supabase
      .from("money_mission_plans")
      .update({ status: "archived" })
      .eq("user_id", this.userId)
      .eq("status", "active");

    return { error: error?.message ?? null };
  }
}
