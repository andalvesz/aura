import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LanguageSession } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class LanguageSessionsRepository extends BaseRepository<"language_sessions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "language_sessions", userId);
  }

  async findByDate(referenceDate: string) {
    const { data, error } = await this.supabase
      .from("language_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("data", referenceDate)
      .order("created_at", { ascending: false });

    return {
      data: (data as LanguageSession[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
