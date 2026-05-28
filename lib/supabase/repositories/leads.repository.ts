import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class LeadsRepository extends BaseRepository<"leads"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "leads", userId);
  }

  async findByStatus(status: string) {
    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    return { data: (data as Lead[]) ?? null, error: error?.message ?? null };
  }

  async findToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("user_id", this.userId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    return { data: (data as Lead[]) ?? null, error: error?.message ?? null };
  }
}
