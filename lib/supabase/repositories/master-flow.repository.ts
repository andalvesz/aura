import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MasterFlow, MasterFlowStatus } from "@/types/database";
import { BaseRepository } from "./base.repository";

const ACTIVE_STATUSES: MasterFlowStatus[] = ["pending", "running"];

export class MasterFlowRepository extends BaseRepository<"master_flows"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "master_flows", userId);
  }

  async findActive(): Promise<{ data: MasterFlow | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("master_flows")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as MasterFlow | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatest(): Promise<{ data: MasterFlow | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("master_flows")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as MasterFlow | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
