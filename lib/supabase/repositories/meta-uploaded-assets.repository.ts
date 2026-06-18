import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MetaUploadedAsset } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class MetaUploadedAssetsRepository extends BaseRepository<"meta_uploaded_assets"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "meta_uploaded_assets", userId);
  }

  async findByAssetId(assetId: string) {
    const { data, error } = await this.supabase
      .from("meta_uploaded_assets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("asset_id", assetId)
      .maybeSingle();

    return {
      data: (data as MetaUploadedAsset | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByAssetIds(assetIds: string[]) {
    if (assetIds.length === 0) {
      return { data: [] as MetaUploadedAsset[], error: null };
    }

    const { data, error } = await this.supabase
      .from("meta_uploaded_assets")
      .select("*")
      .eq("user_id", this.userId)
      .in("asset_id", assetIds);

    return {
      data: (data as MetaUploadedAsset[]) ?? [],
      error: error?.message ?? null,
    };
  }
}
