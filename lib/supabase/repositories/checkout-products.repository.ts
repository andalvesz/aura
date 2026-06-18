import type { SupabaseClient } from "@supabase/supabase-js";
import type { CheckoutPlatform, CheckoutProduct, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CheckoutProductsRepository extends BaseRepository<"checkout_products"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "checkout_products", userId);
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("checkout_products")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CheckoutProduct[]) ?? [],
      error: error?.message ?? null,
    };
  }

  async findReadyByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("checkout_products")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .eq("status", "ready_to_sell")
      .not("checkout_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as CheckoutProduct | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductAndPlatform(productId: string, platform: CheckoutPlatform) {
    const { data, error } = await this.supabase
      .from("checkout_products")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .eq("platform", platform)
      .maybeSingle();

    return {
      data: (data as CheckoutProduct | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("checkout_products")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as CheckoutProduct | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
