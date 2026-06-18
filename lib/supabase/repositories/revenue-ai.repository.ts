import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  RevenueForecast,
  RevenueMetric,
  RevenueForecastPeriod,
  RevenueForecastType,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class RevenueMetricsRepository extends BaseRepository<"revenue_metrics"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "revenue_metrics", userId);
  }

  async findRecent(limit = 1000) {
    const { data, error } = await this.supabase
      .from("revenue_metrics")
      .select("*")
      .eq("user_id", this.userId)
      .order("date", { ascending: false })
      .limit(limit);

    return {
      data: (data as RevenueMetric[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findSince(sinceDate: string) {
    const { data, error } = await this.supabase
      .from("revenue_metrics")
      .select("*")
      .eq("user_id", this.userId)
      .gte("date", sinceDate)
      .order("date", { ascending: true });

    return {
      data: (data as RevenueMetric[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByIdempotencyKey(idempotencyKey: string) {
    const { data, error } = await this.supabase
      .from("revenue_metrics")
      .select("*")
      .eq("user_id", this.userId)
      .filter("metadata->>idempotency_key", "eq", idempotencyKey)
      .maybeSingle();

    return {
      data: (data as RevenueMetric | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class RevenueForecastsRepository extends BaseRepository<"revenue_forecasts"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "revenue_forecasts", userId);
  }

  async findLatest(
    forecastType?: RevenueForecastType,
    period?: RevenueForecastPeriod
  ) {
    let query = this.supabase
      .from("revenue_forecasts")
      .select("*")
      .eq("user_id", this.userId);

    if (forecastType) query = query.eq("forecast_type", forecastType);
    if (period) query = query.eq("period", period);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      data: (data as RevenueForecast[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertForecast(
    payload: Omit<TableInsert<"revenue_forecasts">, "user_id"> & {
      forecast_type: RevenueForecastType;
      period: RevenueForecastPeriod;
    }
  ): Promise<{ data: RevenueForecast | null; error: string | null }> {
    const { data: existing } = await this.supabase
      .from("revenue_forecasts")
      .select("*")
      .eq("user_id", this.userId)
      .eq("forecast_type", payload.forecast_type)
      .eq("period", payload.period)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return this.update((existing as RevenueForecast).id, payload);
    }

    return this.create(payload);
  }
}
