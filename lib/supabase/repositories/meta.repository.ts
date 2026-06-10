import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MetaAdAccount,
  MetaCampaign,
  MetaCampaignMetric,
  MetaConnection,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class MetaConnectionsRepository extends BaseRepository<"meta_connections"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "meta_connections", userId);
  }

  async findForUser() {
    const { data, error } = await this.supabase
      .from("meta_connections")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as MetaConnection | null, error: null };
  }
}

export class MetaAdAccountsRepository extends BaseRepository<"meta_ad_accounts"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "meta_ad_accounts", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("meta_ad_accounts")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as MetaAdAccount[], error: null };
  }
}

export class MetaCampaignsRepository extends BaseRepository<"meta_campaigns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "meta_campaigns", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("meta_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as MetaCampaign[], error: null };
  }

  async findByExternalId(externalCampaignId: string) {
    const { data, error } = await this.supabase
      .from("meta_campaigns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("external_campaign_id", externalCampaignId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as MetaCampaign | null, error: null };
  }
}

export class MetaCampaignMetricsRepository extends BaseRepository<"meta_campaign_metrics"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "meta_campaign_metrics", userId);
  }

  async findLatestForCampaign(campaignId: string) {
    const { data, error } = await this.supabase
      .from("meta_campaign_metrics")
      .select("*")
      .eq("user_id", this.userId)
      .eq("campaign_id", campaignId)
      .order("metrics_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as MetaCampaignMetric | null, error: null };
  }
}
