import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeGeneratedAsset, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreativeGeneratedAssetsRepository extends BaseRepository<"creative_generated_assets"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creative_generated_assets", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creative_generated_assets")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeGeneratedAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creative_generated_assets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreativeGeneratedAsset | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByCreativeId(creativeId: string) {
    const { data, error } = await this.supabase
      .from("creative_generated_assets")
      .select("*")
      .eq("user_id", this.userId)
      .eq("creative_id", creativeId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeGeneratedAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByOperationId(operationId: string) {
    const { data, error } = await this.supabase
      .from("creative_generated_assets")
      .select("*")
      .eq("user_id", this.userId)
      .filter("metadata->>operation_id", "eq", operationId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeGeneratedAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) {
      return { data: [] as CreativeGeneratedAsset[], error: null };
    }

    const { data, error } = await this.supabase
      .from("creative_generated_assets")
      .select("*")
      .eq("user_id", this.userId)
      .in("id", ids)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreativeGeneratedAsset[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
