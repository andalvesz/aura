import type { SupabaseClient } from "@supabase/supabase-js";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import type {
  Database,
  GlobalMarket,
  GlobalResult,
  GlobalStrategy,
} from "@/types/database";

export class GlobalMarketsRepository extends BaseRepository<"global_markets"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "global_markets", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("global_markets")
      .select("*")
      .eq("user_id", this.userId)
      .order("global_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    return {
      data: (data as GlobalMarket[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActive() {
    const { data, error } = await this.supabase
      .from("global_markets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("global_score", { ascending: false, nullsFirst: false });
    return {
      data: (data as GlobalMarket[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class GlobalStrategiesRepository extends BaseRepository<"global_strategies"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "global_strategies", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("global_strategies")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as GlobalStrategy[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByMarketId(marketId: string) {
    const { data, error } = await this.supabase
      .from("global_strategies")
      .select("*")
      .eq("user_id", this.userId)
      .eq("market_id", marketId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      data: (data as GlobalStrategy | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class GlobalResultsRepository extends BaseRepository<"global_results"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "global_results", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("global_results")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as GlobalResult[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
