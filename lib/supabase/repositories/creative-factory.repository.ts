import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreativeAssetsRepository extends BaseRepository<"creative_assets"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creative_assets", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creative_assets")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creative_assets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreativeAsset | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByOperationId(operationId: string) {
    const { data, error } = await this.supabase
      .from("creative_assets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("operation_id", operationId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async countByOperationId(operationId: string) {
    const { count, error } = await this.supabase
      .from("creative_assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("operation_id", operationId)
      .eq("status", "ready");

    return {
      count: count ?? 0,
      error: error?.message ?? null,
    };
  }
}
