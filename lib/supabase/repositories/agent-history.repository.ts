import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AgentHistory } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AgentHistoryRepository extends BaseRepository<"agent_history"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "agent_history", userId);
  }

  async findRecent(limit = 15) {
    const { data, error } = await this.supabase
      .from("agent_history")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as AgentHistory[], error: null };
  }
}
