import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdPlatformConnection, AdPlatform, Database, TableInsert } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AdPlatformConnectionsRepository extends BaseRepository<"ad_platform_connections"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "ad_platform_connections", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("ad_platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    return {
      data: (data as AdPlatformConnection[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByPlatform(platform: AdPlatform) {
    const { data, error } = await this.supabase
      .from("ad_platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    return {
      data: (data as AdPlatformConnection[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findDefaultForPlatform(platform: AdPlatform) {
    const { data, error } = await this.supabase
      .from("ad_platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .eq("is_default", true)
      .maybeSingle();

    if (data) {
      return { data: data as AdPlatformConnection, error: null };
    }

    const { data: fallback, error: fallbackError } = await this.supabase
      .from("ad_platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (fallback as AdPlatformConnection | null) ?? null,
      error: fallbackError?.message ?? error?.message ?? null,
    };
  }

  async findByExternalAccount(platform: AdPlatform, externalAccountId: string) {
    const { data, error } = await this.supabase
      .from("ad_platform_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .eq("external_account_id", externalAccountId)
      .maybeSingle();

    return {
      data: (data as AdPlatformConnection | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertConnection(
    payload: Omit<TableInsert<"ad_platform_connections">, "user_id">
  ) {
    if (!payload.external_account_id?.trim()) {
      return { data: null, error: "external_account_id obrigatório." };
    }

    const existing = await this.findByExternalAccount(
      payload.platform as AdPlatform,
      payload.external_account_id
    );

    if (existing.data) {
      const { data, error } = await this.supabase
        .from("ad_platform_connections")
        .update({
          account_label: payload.account_label ?? existing.data.account_label,
          status: payload.status ?? existing.data.status,
          is_default: payload.is_default ?? existing.data.is_default,
          meta_connection_id: payload.meta_connection_id ?? existing.data.meta_connection_id,
          platform_connection_id:
            payload.platform_connection_id ?? existing.data.platform_connection_id,
          metadata: payload.metadata ?? existing.data.metadata,
          last_sync_at: payload.last_sync_at ?? new Date().toISOString(),
        })
        .eq("id", existing.data.id)
        .select("*")
        .single();

      return {
        data: (data as AdPlatformConnection | null) ?? null,
        error: error?.message ?? null,
      };
    }

    return this.create(payload);
  }
}
