import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  KiwifyCommission,
  KiwifyConnection,
  KiwifyProduct,
  KiwifySale,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class KiwifyConnectionsRepository extends BaseRepository<"kiwify_connections"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "kiwify_connections", userId);
  }

  async findForUser() {
    const { data, error } = await this.supabase
      .from("kiwify_connections")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as KiwifyConnection | null, error: null };
  }
}

export class KiwifyProductsRepository extends BaseRepository<"kiwify_products"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "kiwify_products", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("kiwify_products")
      .select("*")
      .eq("user_id", this.userId)
      .order("affiliate_score", { ascending: false, nullsFirst: false });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as KiwifyProduct[], error: null };
  }
}

export class KiwifySalesRepository extends BaseRepository<"kiwify_sales"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "kiwify_sales", userId);
  }

  async findRecent(limit = 50) {
    const { data, error } = await this.supabase
      .from("kiwify_sales")
      .select("*")
      .eq("user_id", this.userId)
      .order("sold_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as KiwifySale[], error: null };
  }
}

export class KiwifyCommissionsRepository extends BaseRepository<"kiwify_commissions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "kiwify_commissions", userId);
  }

  async findRecent(limit = 50) {
    const { data, error } = await this.supabase
      .from("kiwify_commissions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as KiwifyCommission[], error: null };
  }
}
