import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuraSmartLaunchSession, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class AuraSmartLaunchRepository extends BaseRepository<"aura_smart_launch_sessions"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "aura_smart_launch_sessions", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("aura_smart_launch_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as AuraSmartLaunchSession[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("aura_smart_launch_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();

    return {
      data: (data as AuraSmartLaunchSession | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findBestPrepared() {
    const { data, error } = await this.supabase
      .from("aura_smart_launch_sessions")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "prepared")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return { data: null, error: error.message };
    }

    const sessions = (data as AuraSmartLaunchSession[]) ?? [];
    const best = [...sessions].sort((a, b) => {
      const scoreA =
        typeof (a.smart_score as { score_geral?: number })?.score_geral === "number"
          ? (a.smart_score as { score_geral: number }).score_geral
          : 0;
      const scoreB =
        typeof (b.smart_score as { score_geral?: number })?.score_geral === "number"
          ? (b.smart_score as { score_geral: number }).score_geral
          : 0;
      return scoreB - scoreA;
    })[0];

    return { data: best ?? null, error: null };
  }
}
