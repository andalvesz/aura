import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LanguageLesson, LanguageModo } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class LanguageLessonsRepository extends BaseRepository<"language_lessons"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "language_lessons", userId);
  }

  async findByModo(modo: LanguageModo) {
    const { data, error } = await this.supabase
      .from("language_lessons")
      .select("*")
      .eq("user_id", this.userId)
      .eq("modo", modo)
      .order("ordem", { ascending: true });

    return {
      data: (data as LanguageLesson[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
