import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AutoImproveAssetType,
  Database,
  ImprovementCycle,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ImprovementCyclesRepository extends BaseRepository<"improvement_cycles"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "improvement_cycles", userId);
  }

  async findByAsset(assetType: AutoImproveAssetType, assetId: string) {
    const { data, error } = await this.supabase
      .from("improvement_cycles")
      .select("*")
      .eq("user_id", this.userId)
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .order("cycle_number", { ascending: true });

    return {
      data: (data as ImprovementCycle[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async countByAsset(assetType: AutoImproveAssetType, assetId: string) {
    const { data, error } = await this.supabase
      .from("improvement_cycles")
      .select("id")
      .eq("user_id", this.userId)
      .eq("asset_type", assetType)
      .eq("asset_id", assetId);

    return {
      count: (data ?? []).length,
      error: error?.message ?? null,
    };
  }

  async recordCycle(
    payload: Omit<TableInsert<"improvement_cycles">, "user_id">
  ): Promise<{ data: ImprovementCycle | null; error: string | null }> {
    return this.create(payload);
  }
}
