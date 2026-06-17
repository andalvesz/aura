import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdSet, Database, TableInsert } from "@/types/database";

export class AdSetsRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string
  ) {}

  async findByCampaignId(campaignId: string) {
    const { data, error } = await this.supabase
      .from("ad_sets")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdSet[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async create(payload: Omit<TableInsert<"ad_sets">, "id">) {
    const { data, error } = await this.supabase
      .from("ad_sets")
      .insert(payload)
      .select("*")
      .single();

    return {
      data: (data as AdSet | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findAllForUserCampaigns(campaignIds: string[]) {
    if (campaignIds.length === 0) return { data: [] as AdSet[], error: null };

    const { data, error } = await this.supabase
      .from("ad_sets")
      .select("*")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdSet[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
