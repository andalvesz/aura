import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreatorLaunchPlan, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class CreatorLaunchPlansRepository extends BaseRepository<"creator_launch_plans"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "creator_launch_plans", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("creator_launch_plans")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as CreatorLaunchPlan[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("creator_launch_plans")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as CreatorLaunchPlan | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
