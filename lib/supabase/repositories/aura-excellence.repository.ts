import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ExcellenceAssetType,
  QualityReview,
  QualityScore,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class QualityReviewsRepository extends BaseRepository<"quality_reviews"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "quality_reviews", userId);
  }

  async findByAsset(assetType: ExcellenceAssetType, assetId: string) {
    const { data, error } = await this.supabase
      .from("quality_reviews")
      .select("*")
      .eq("user_id", this.userId)
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false });

    return {
      data: (data as QualityReview[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findRecent(limit = 200) {
    const { data, error } = await this.supabase
      .from("quality_reviews")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as QualityReview[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async createMany(payloads: Array<Omit<TableInsert<"quality_reviews">, "user_id">>) {
    if (!payloads.length) return { data: [] as QualityReview[], error: null };

    const rows = payloads.map((payload) => ({ ...payload, user_id: this.userId }));
    const { data, error } = await this.supabase
      .from("quality_reviews")
      .insert(rows)
      .select("*");

    return {
      data: (data as QualityReview[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByAsset(assetType: ExcellenceAssetType, assetId: string) {
    const { error } = await this.supabase
      .from("quality_reviews")
      .delete()
      .eq("user_id", this.userId)
      .eq("asset_type", assetType)
      .eq("asset_id", assetId);

    return { error: error?.message ?? null };
  }
}

export class QualityScoresRepository extends BaseRepository<"quality_scores"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "quality_scores", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("quality_scores")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });

    return {
      data: (data as QualityScore[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByAsset(assetType: ExcellenceAssetType, assetId: string) {
    const { data, error } = await this.supabase
      .from("quality_scores")
      .select("*")
      .eq("user_id", this.userId)
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .maybeSingle();

    return {
      data: (data as QualityScore | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertScore(
    payload: Omit<TableInsert<"quality_scores">, "user_id">
  ) {
    const { data, error } = await this.supabase
      .from("quality_scores")
      .upsert(
        { ...payload, user_id: this.userId },
        { onConflict: "user_id,asset_type,asset_id" }
      )
      .select("*")
      .single();

    return {
      data: (data as QualityScore) ?? null,
      error: error?.message ?? null,
    };
  }
}
