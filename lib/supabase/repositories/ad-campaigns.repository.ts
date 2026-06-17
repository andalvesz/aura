import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdCampaign, AdCampaignStatus, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AdCampaignsRepository extends BaseRepository<"ad_campaigns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "ad_campaigns", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdCampaign[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as AdCampaign | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByOperationId(operationId: string) {
    const { data, error } = await this.supabase
      .from("ad_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("operation_id", operationId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdCampaign[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async countByStatus(status: AdCampaignStatus) {
    const { count, error } = await this.supabase
      .from("ad_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("status", status);

    return { count: count ?? 0, error: error?.message ?? null };
  }
}
