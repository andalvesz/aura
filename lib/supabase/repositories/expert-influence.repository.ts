import type { ExpertInfluenceLog } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ExpertInfluenceLogsRepository extends BaseRepository<"expert_influence_logs"> {
  constructor(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
    super(supabase, "expert_influence_logs", userId);
  }

  async findRecent(limit = 100) {
    const { data, error } = await this.supabase
      .from("expert_influence_logs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: (data as ExpertInfluenceLog[]) ?? null, error: error?.message ?? null };
  }

  async findRecentByModule(moduleName: string, limit = 5) {
    const { data, error } = await this.supabase
      .from("expert_influence_logs")
      .select("*")
      .eq("user_id", this.userId)
      .eq("module_name", moduleName)
      .order("created_at", { ascending: false })
      .limit(limit);

    return { data: (data as ExpertInfluenceLog[]) ?? null, error: error?.message ?? null };
  }
}
