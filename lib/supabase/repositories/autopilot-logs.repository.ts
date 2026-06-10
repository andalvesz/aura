import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutopilotLog, AutopilotLogEventType, Database, Json } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AutopilotLogsRepository extends BaseRepository<"autopilot_logs"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "autopilot_logs", userId);
  }

  async findAllOrdered(limit = 50) {
    const { data, error } = await this.supabase
      .from("autopilot_logs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as AutopilotLog[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async append(entry: {
    event_type: AutopilotLogEventType;
    message: string;
    campaign_id?: string | null;
    action_id?: string | null;
    details?: Json;
  }) {
    return this.create({
      event_type: entry.event_type,
      message: entry.message,
      campaign_id: entry.campaign_id ?? null,
      action_id: entry.action_id ?? null,
      details: entry.details ?? {},
    });
  }
}
