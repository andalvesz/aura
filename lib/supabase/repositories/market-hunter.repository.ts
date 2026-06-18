import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MarketOpportunity, MarketWatchlist, TableInsert } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class MarketOpportunitiesRepository extends BaseRepository<"market_opportunities"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "market_opportunities", userId);
  }

  async findRecent(limit = 200) {
    const { data, error } = await this.supabase
      .from("market_opportunities")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as MarketOpportunity[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findTopScored(limit = 20) {
    const { data, error } = await this.supabase
      .from("market_opportunities")
      .select("*")
      .eq("user_id", this.userId)
      .order("opportunity_score", { ascending: false })
      .limit(limit);

    return {
      data: (data as MarketOpportunity[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertByProduct(
    payload: Omit<TableInsert<"market_opportunities">, "user_id">
  ): Promise<{ data: MarketOpportunity | null; error: string | null }> {
    const { data: existing } = await this.supabase
      .from("market_opportunities")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_name", payload.product_name)
      .eq("source_platform", payload.source_platform ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const row = existing as MarketOpportunity;
      if (Number(payload.opportunity_score ?? 0) <= Number(row.opportunity_score ?? 0)) {
        return { data: row, error: null };
      }
      return this.update(row.id, {
        niche: payload.niche,
        country: payload.country,
        language: payload.language,
        currency: payload.currency,
        estimated_demand: payload.estimated_demand,
        estimated_competition: payload.estimated_competition,
        estimated_conversion: payload.estimated_conversion,
        opportunity_score: payload.opportunity_score,
        recommendation: payload.recommendation,
        metadata: payload.metadata,
      });
    }

    return this.create(payload);
  }
}

export class MarketWatchlistRepository extends BaseRepository<"market_watchlist"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "market_watchlist", userId);
  }

  async findActive(limit = 50) {
    const { data, error } = await this.supabase
      .from("market_watchlist")
      .select("*")
      .eq("user_id", this.userId)
      .neq("status", "archived")
      .order("score", { ascending: false })
      .limit(limit);

    return {
      data: (data as MarketWatchlist[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
