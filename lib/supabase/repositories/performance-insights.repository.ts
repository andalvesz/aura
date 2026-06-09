import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PerformanceInsight } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class PerformanceInsightsRepository extends BaseRepository<"performance_insights"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "performance_insights", userId);
  }

  async findByReportId(reportId: string) {
    const { data, error } = await this.supabase
      .from("performance_insights")
      .select("*")
      .eq("user_id", this.userId)
      .eq("report_id", reportId)
      .order("score", { ascending: false });

    return {
      data: (data as PerformanceInsight[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByReportId(reportId: string) {
    const { error } = await this.supabase
      .from("performance_insights")
      .delete()
      .eq("user_id", this.userId)
      .eq("report_id", reportId);

    return { error: error?.message ?? null };
  }
}
