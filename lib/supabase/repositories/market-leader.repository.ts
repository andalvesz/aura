import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MarketBenchmark, MarketBenchmarkCategory } from "@/types/database";

export class MarketBenchmarksRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findAllActive() {
    const { data, error } = await this.supabase
      .from("market_benchmarks")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true });

    return {
      data: (data as MarketBenchmark[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByCategory(category: MarketBenchmarkCategory) {
    const { data, error } = await this.supabase
      .from("market_benchmarks")
      .select("*")
      .eq("category", category)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as MarketBenchmark | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
