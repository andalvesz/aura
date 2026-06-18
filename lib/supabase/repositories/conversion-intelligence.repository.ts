import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversionInsight, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ConversionInsightsRepository extends BaseRepository<"conversion_insights"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "conversion_insights", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("conversion_insights")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as ConversionInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findRecent(limit = 100) {
    const { data, error } = await this.supabase
      .from("conversion_insights")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as ConversionInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByFunnelId(funnelId: string) {
    const { data, error } = await this.supabase
      .from("conversion_insights")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .order("confidence_score", { ascending: false });

    return {
      data: (data as ConversionInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteOlderThan(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { error } = await this.supabase
      .from("conversion_insights")
      .delete()
      .eq("user_id", this.userId)
      .lt("created_at", cutoff.toISOString());

    return { error: error?.message ?? null };
  }

  async deleteAll() {
    const { error } = await this.supabase
      .from("conversion_insights")
      .delete()
      .eq("user_id", this.userId);

    return { error: error?.message ?? null };
  }
}
