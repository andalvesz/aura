import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Funnel, FunnelStep } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class FunnelsRepository extends BaseRepository<"funnels"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "funnels", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("funnels")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Funnel[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("funnels")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as Funnel | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("funnels")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Funnel[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatestByProductId(productId: string) {
    const { data, error } = await this.supabase
      .from("funnels")
      .select("*")
      .eq("user_id", this.userId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as Funnel | null) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class FunnelStepsRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private userId: string
  ) {}

  async findByFunnelId(funnelId: string) {
    const { data, error } = await this.supabase
      .from("funnel_steps")
      .select("*")
      .eq("funnel_id", funnelId)
      .order("step_order", { ascending: true });

    return {
      data: (data as FunnelStep[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async createStep(payload: Omit<FunnelStep, "id" | "created_at"> & { id?: string }) {
    const { data: funnel } = await this.supabase
      .from("funnels")
      .select("id")
      .eq("id", payload.funnel_id)
      .eq("user_id", this.userId)
      .maybeSingle();

    if (!funnel) {
      return { data: null, error: "Funil não encontrado." };
    }

    const { data, error } = await this.supabase
      .from("funnel_steps")
      .insert(payload)
      .select("*")
      .single();

    return {
      data: (data as FunnelStep | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByFunnelId(funnelId: string) {
    const { error } = await this.supabase.from("funnel_steps").delete().eq("funnel_id", funnelId);
    return { error: error?.message ?? null };
  }
}
