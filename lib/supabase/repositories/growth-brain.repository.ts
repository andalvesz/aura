import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GrowthBrainMemory,
  GrowthPattern,
  GrowthPatternType,
  TableInsert,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

export class GrowthBrainMemoriesRepository extends BaseRepository<"growth_brain_memories"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_brain_memories", userId);
  }

  async findRecent(limit = 500) {
    const { data, error } = await this.supabase
      .from("growth_brain_memories")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as GrowthBrainMemory[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findActive(limit = 500) {
    const { data, error } = await this.supabase
      .from("growth_brain_memories")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit);

    return {
      data: (data as GrowthBrainMemory[]) ?? null,
      error: error?.message ?? null,
    };
  }
}

export class GrowthPatternsRepository extends BaseRepository<"growth_patterns"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_patterns", userId);
  }

  async findByType(patternType: GrowthPatternType, limit = 20) {
    const { data, error } = await this.supabase
      .from("growth_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("pattern_type", patternType)
      .order("score", { ascending: false })
      .limit(limit);

    return {
      data: (data as GrowthPattern[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsertPattern(
    payload: Omit<TableInsert<"growth_patterns">, "user_id">
  ): Promise<{ data: GrowthPattern | null; error: string | null }> {
    const { data: existing } = await this.supabase
      .from("growth_patterns")
      .select("*")
      .eq("user_id", this.userId)
      .eq("pattern_type", payload.pattern_type)
      .eq("niche", payload.niche ?? "")
      .eq("country", payload.country ?? "")
      .eq("language", payload.language ?? "")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const row = existing as GrowthPattern;
      if (Number(payload.score ?? 0) <= Number(row.score)) {
        return { data: row, error: null };
      }
      return this.update(row.id, {
        score: payload.score,
        lesson: payload.lesson,
        recommendation: payload.recommendation,
      });
    }

    return this.create(payload);
  }
}
