import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PerformanceReport } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class PerformanceReportsRepository extends BaseRepository<"performance_reports"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "performance_reports", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("performance_reports")
      .select("*")
      .eq("user_id", this.userId)
      .order("report_date", { ascending: false });

    return {
      data: (data as PerformanceReport[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findLatestActive() {
    const { data, error } = await this.supabase
      .from("performance_reports")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "active")
      .order("report_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as PerformanceReport | null) ?? null,
      error: error?.message ?? null,
    };
  }
}
