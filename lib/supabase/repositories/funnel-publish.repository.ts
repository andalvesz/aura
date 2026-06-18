import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FunnelPublishLog } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class FunnelPublishLogsRepository extends BaseRepository<"funnel_publish_logs"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "funnel_publish_logs", userId);
  }

  async findByFunnelId(funnelId: string, limit = 10) {
    const { data, error } = await this.supabase
      .from("funnel_publish_logs")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as FunnelPublishLog[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatestByFunnelId(funnelId: string) {
    const { data, error } = await this.supabase
      .from("funnel_publish_logs")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as FunnelPublishLog | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
