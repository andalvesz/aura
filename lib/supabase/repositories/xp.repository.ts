import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserXp, XpHistory } from "@/types/database";
import { BaseRepository, type RepositoryResult } from "./base.repository";

export class UserXpRepository extends BaseRepository<"user_xp"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "user_xp", userId);
  }

  async findForUser(): Promise<RepositoryResult<UserXp>> {
    const { data, error } = await this.supabase
      .from("user_xp")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();

    return {
      data: (data as UserXp | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async ensureRow(): Promise<RepositoryResult<UserXp>> {
    const existing = await this.findForUser();
    if (existing.error) return existing;
    if (existing.data) return existing;

    return this.create({
      xp_total: 0,
      nivel: 1,
      streak_dias: 0,
    });
  }
}

export class XpHistoryRepository extends BaseRepository<"xp_history"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "xp_history", userId);
  }

  async findRecent(limit = 8): Promise<RepositoryResult<XpHistory[]>> {
    const { data, error } = await this.supabase
      .from("xp_history")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as XpHistory[] | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findSince(sinceIso: string): Promise<RepositoryResult<XpHistory[]>> {
    const { data, error } = await this.supabase
      .from("xp_history")
      .select("*")
      .eq("user_id", this.userId)
      .gte("created_at", `${sinceIso}T00:00:00.000Z`)
      .order("created_at", { ascending: false });

    return {
      data: (data as XpHistory[] | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async hasIdempotencyKey(key: string): Promise<RepositoryResult<boolean>> {
    const { count, error } = await this.supabase
      .from("xp_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("idempotency_key", key);

    return {
      data: (count ?? 0) > 0,
      error: error?.message ?? null,
    };
  }

  async hasActivityOnDate(dateIso: string): Promise<RepositoryResult<boolean>> {
    const next = new Date(`${dateIso}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);

    const { count, error } = await this.supabase
      .from("xp_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .gte("created_at", `${dateIso}T00:00:00.000Z`)
      .lt("created_at", next.toISOString());

    return {
      data: (count ?? 0) > 0,
      error: error?.message ?? null,
    };
  }
}
