import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExecutionTask } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ExecutionTasksRepository extends BaseRepository<"execution_tasks"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "execution_tasks", userId);
  }

  async findByPlanId(planId: string) {
    const { data, error } = await this.supabase
      .from("execution_tasks")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plan_id", planId)
      .order("ordem", { ascending: true });

    return {
      data: (data as ExecutionTask[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async createMany(
    tasks: Omit<import("@/types/database").TableInsert<"execution_tasks">, "user_id">[]
  ) {
    if (tasks.length === 0) return { data: [] as ExecutionTask[], error: null };

    const rows = tasks.map((t) => ({ ...t, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("execution_tasks")
      .insert(rows)
      .select("*");

    return {
      data: (data as ExecutionTask[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByPlanId(planId: string) {
    const { error } = await this.supabase
      .from("execution_tasks")
      .delete()
      .eq("user_id", this.userId)
      .eq("plan_id", planId);

    return { error: error?.message ?? null };
  }

  async deleteBySourceRefPrefix(prefix: string) {
    const { error } = await this.supabase
      .from("execution_tasks")
      .delete()
      .eq("user_id", this.userId)
      .like("source_ref", `${prefix}%`);

    return { error: error?.message ?? null };
  }
}
