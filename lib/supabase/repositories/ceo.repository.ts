import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuraCeoSession, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AuraCeoSessionsRepository extends BaseRepository<"aura_ceo_sessions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "aura_ceo_sessions", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("aura_ceo_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AuraCeoSession[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActive() {
    const { data, error } = await this.supabase
      .from("aura_ceo_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as AuraCeoSession | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async archiveActive() {
    const { error } = await this.supabase
      .from("aura_ceo_sessions")
      .update({ status: "archived" })
      .eq("user_id", this.userId)
      .eq("status", "active");

    return { error: error?.message ?? null };
  }
}
