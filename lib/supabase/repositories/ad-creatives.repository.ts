import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdCreative, Database, TableInsert } from "@/types/database";

export class AdCreativesRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string
  ) {}

  async findByCampaignId(campaignId: string) {
    const { data, error } = await this.supabase
      .from("ad_creatives")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdCreative[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async update(
    id: string,
    patch: Partial<Omit<AdCreative, "id" | "campaign_id" | "created_at">>
  ) {
    const { data, error } = await this.supabase
      .from("ad_creatives")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    return {
      data: (data as AdCreative | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async create(payload: Omit<TableInsert<"ad_creatives">, "id">) {
    const { data, error } = await this.supabase
      .from("ad_creatives")
      .insert(payload)
      .select("*")
      .single();

    return {
      data: (data as AdCreative | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findAllForUserCampaigns(campaignIds: string[]) {
    if (campaignIds.length === 0) return { data: [] as AdCreative[], error: null };

    const { data, error } = await this.supabase
      .from("ad_creatives")
      .select("*")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    return {
      data: (data as AdCreative[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
