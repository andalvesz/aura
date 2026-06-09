import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorLanding, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorLandingsRepository extends BaseRepository<"creator_landings"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_landings", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creator_landings")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreatorLanding[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("creator_landings")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CreatorLanding | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("creator_landings")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as CreatorLanding | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
