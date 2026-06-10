import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutopilotAction, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AutopilotActionsRepository extends BaseRepository<"autopilot_actions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "autopilot_actions", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("autopilot_actions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AutopilotAction[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findPending() {
    const { data, error } = await this.supabase
      .from("autopilot_actions")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", ["pending_approval", "suggested", "approved"])
      .order("created_at", { ascending: false });

    return {
      data: (data as AutopilotAction[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
