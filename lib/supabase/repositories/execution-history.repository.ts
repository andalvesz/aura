import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExecutionHistoryEntry } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ExecutionHistoryRepository extends BaseRepository<"execution_history"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "execution_history", userId);
  }

  async findRecent(limit = 20) {
    const { data, error } = await this.supabase
      .from("execution_history")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ExecutionHistoryEntry[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findSince(dateIso: string) {
    const { data, error } = await this.supabase
      .from("execution_history")
      .select("*")
      .eq("user_id", this.userId)
      .gte("created_at", `${dateIso}T00:00:00`)
      .order("created_at", { ascending: false });

    return {
      data: (data as ExecutionHistoryEntry[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
