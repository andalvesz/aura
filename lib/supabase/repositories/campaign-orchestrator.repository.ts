import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorCampaignOrchestration, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorCampaignOrchestrationsRepository extends BaseRepository<"creator_campaign_orchestrations"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_campaign_orchestrations", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creator_campaign_orchestrations")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreatorCampaignOrchestration[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creator_campaign_orchestrations")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreatorCampaignOrchestration | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("creator_campaign_orchestrations")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as CreatorCampaignOrchestration | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
