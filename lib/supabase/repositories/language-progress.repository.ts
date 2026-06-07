import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LanguageProgress } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class LanguageProgressRepository extends BaseRepository<"language_progress"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "language_progress", userId);
  }

  async findByUser(): Promise<{
    data: LanguageProgress | null;
    error: string | null;
  }> {
    const { data, error } = await this.supabase
      .from("language_progress")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();

    return {
      data: (data as LanguageProgress) ?? null,
      error: error?.message ?? null,
    };
  }
}
