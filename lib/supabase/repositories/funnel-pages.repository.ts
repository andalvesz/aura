import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FunnelPage, FunnelPageType } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class FunnelPagesRepository extends BaseRepository<"funnel_pages"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "funnel_pages", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("funnel_pages")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as FunnelPage[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByFunnelId(funnelId: string) {
    const { data, error } = await this.supabase
      .from("funnel_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .order("created_at", { ascending: true });

    return {
      data: (data as FunnelPage[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("funnel_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("slug", slug)
      .maybeSingle();

    return {
      data: (data as FunnelPage | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async slugExists(slug: string) {
    const { data, error } = await this.supabase
      .from("funnel_pages")
      .select("id")
      .eq("user_id", this.userId)
      .eq("slug", slug)
      .maybeSingle();

    return {
      exists: Boolean(data?.id),
      error: error?.message ?? null,
    };
  }

  async deleteByFunnelId(funnelId: string) {
    const { error } = await this.supabase
      .from("funnel_pages")
      .delete()
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId);

    return { error: error?.message ?? null };
  }

  async countByStatus(status: FunnelPage["status"]) {
    const { count, error } = await this.supabase
      .from("funnel_pages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("status", status);

    return {
      count: count ?? 0,
      error: error?.message ?? null,
    };
  }

  async findByPageType(funnelId: string, pageType: FunnelPageType) {
    const { data, error } = await this.supabase
      .from("funnel_pages")
      .select("*")
      .eq("user_id", this.userId)
      .eq("funnel_id", funnelId)
      .eq("page_type", pageType)
      .order("created_at", { ascending: true });

    return {
      data: (data as FunnelPage[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
