import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutopilotSettings, Database, Json } from "@/types/database";
import type { AutopilotControlLevel } from "@/types/database";

export class AutopilotSettingsRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string
  ) {}

  async findForUser() {
    const { data, error } = await this.supabase
      .from("autopilot_rules")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();

    return {
      data: (data as AutopilotSettings | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsert(payload: {
    control_level: AutopilotControlLevel;
    rules: Json;
  }) {
    const { data, error } = await this.supabase
      .from("autopilot_rules")
      .upsert(
        {
          user_id: this.userId,
          control_level: payload.control_level,
          rules: payload.rules,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    return {
      data: (data as AutopilotSettings | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
