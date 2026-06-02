import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GrowthGoal } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class GrowthGoalsRepository extends BaseRepository<"growth_goals"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_goals", userId);
  }

  async findCurrentMonth(mesReferencia: string) {
    const { data, error } = await this.supabase
      .from("growth_goals")
      .select("*")
      .eq("user_id", this.userId)
      .eq("mes_referencia", mesReferencia)
      .maybeSingle();
    return { data: (data as GrowthGoal | null) ?? null, error: error?.message ?? null };
  }
}

export class GrowthMissionsRepository extends BaseRepository<"growth_missions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_missions", userId);
  }
}

export class GrowthActionsRepository extends BaseRepository<"growth_actions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_actions", userId);
  }
}

export class GrowthProfilesRepository extends BaseRepository<"growth_profiles"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_profiles", userId);
  }
}

export class GrowthAnalysesRepository extends BaseRepository<"growth_analyses"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_analyses", userId);
  }
}

export class GrowthLeadsRepository extends BaseRepository<"growth_leads"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "growth_leads", userId);
  }
}
