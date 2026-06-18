import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Offer } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class OffersRepository extends BaseRepository<"offers"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "offers", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("offers")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Offer[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("offers")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Offer[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByFunnelId(funnelId: string) {
    const { data, error } = await this.supabase
      .from("offers")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Offer[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByProductAndFunnel(productId: string, funnelId: string | null) {
    let query = this.supabase
      .from("offers")
      .delete()
      .eq("user_id", this.userId)
      .eq("product_id", productId);

    if (funnelId) {
      query = query.eq("funnel_id", funnelId);
    } else {
      query = query.is("funnel_id", null);
    }

    const { error } = await query;
    return { error: error?.message ?? null };
  }
}
