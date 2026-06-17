import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LandingPage } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class LandingPagesRepository extends BaseRepository<"landing_pages"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "landing_pages", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("landing_pages")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as LandingPage[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("landing_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as LandingPage | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("landing_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("slug", slug)
      .maybeSingle();

    return {
      data: (data as LandingPage | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByOperationId(operationId: string) {
    const { data, error } = await this.supabase
      .from("landing_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("operation_id", operationId)
      .order("created_at", { ascending: false });

    return {
      data: (data as LandingPage[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async slugExists(slug: string, excludeId?: string) {
    let query = this.supabase
      .from("landing_pages")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { count, error } = await query;
    return {
      exists: (count ?? 0) > 0,
      error: error?.message ?? null,
    };
  }
}
