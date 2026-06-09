import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MoneyMissionTask } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class MoneyMissionTasksRepository extends BaseRepository<"money_mission_tasks"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "money_mission_tasks", userId);
  }

  async findByPlanId(planId: string) {
    const { data, error } = await this.supabase
      .from("money_mission_tasks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_id", planId)
      .order("ordem", { ascending: true });

    return {
      data: (data as MoneyMissionTask[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async createMany(
    tasks: Omit<
      import("@/types/database").TableInsert<"money_mission_tasks">,
      "user_id"
    >[]
  ) {
    if (tasks.length === 0) return { data: [] as MoneyMissionTask[], error: null };

    const rows = tasks.map((t) => ({ ...t, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("money_mission_tasks")
      .insert(rows)
      .select("*");

    return {
      data: (data as MoneyMissionTask[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
