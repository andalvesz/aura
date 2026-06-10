import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutopilotMonitor, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AutopilotMonitorsRepository extends BaseRepository<"autopilot_monitors"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "autopilot_monitors", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("autopilot_monitors")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });

    return {
      data: (data as AutopilotMonitor[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByCampaignId(campaignId: string) {
    const { data, error } = await this.supabase
      .from("autopilot_monitors")
      .select("*")
      .eq("user_id", this.userId)
      .eq("campaign_id", campaignId)
      .maybeSingle();

    return {
      data: (data as AutopilotMonitor | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
