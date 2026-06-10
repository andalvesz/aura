import type { SupabaseClient } from "@supabase/supabase-js";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import type {
  AffiliateAnalysis,
  AffiliateProduct,
  Database,
  PlatformConnection,
  PlatformId,
  PlatformSyncLog,
  AffiliateAnalysisType,
  TableInsert,
} from "@/types/database";

export class PlatformConnectionsRepository extends BaseRepository<"platform_connections"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "platform_connections", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as PlatformConnection[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByPlatform(platform: PlatformId) {
    const { data, error } = await this.supabase
      .from("platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .maybeSingle();
    return {
      data: (data as PlatformConnection | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class PlatformSyncLogsRepository extends BaseRepository<"platform_sync_logs"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "platform_sync_logs", userId);
  }

  async findRecent(limit = 20) {
    const { data, error } = await this.supabase
      .from("platform_sync_logs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return {
      data: (data as PlatformSyncLog[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class AffiliateProductsRepository extends BaseRepository<"affiliate_products"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "affiliate_products", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("affiliate_products")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });
    return {
      data: (data as AffiliateProduct[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertMany(
    rows: Omit<TableInsert<"affiliate_products">, "user_id">[]
  ) {
    if (rows.length === 0) return { data: [], error: null };

    const payload = rows.map((row) => ({
      ...row,
      user_id: this.userId,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.supabase
      .from("affiliate_products")
      .upsert(payload, { onConflict: "user_id,platform,external_product_id" })
      .select("*");

    return {
      data: (data as AffiliateProduct[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class AffiliateAnalysisRepository extends BaseRepository<"affiliate_analysis"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "affiliate_analysis", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("affiliate_analysis")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return {
      data: (data as AffiliateAnalysis[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatestByType(analysisType: AffiliateAnalysisType) {
    const { data, error } = await this.supabase
      .from("affiliate_analysis")
      .select("*")
      .eq("user_id", this.userId)
      .eq("analysis_type", analysisType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      data: (data as AffiliateAnalysis | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
