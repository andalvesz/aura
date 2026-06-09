import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PerformanceMetric } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class PerformanceMetricsRepository extends BaseRepository<"performance_metrics"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "performance_metrics", userId);
  }

  async findByReportId(reportId: string) {
    const { data, error } = await this.supabase
      .from("performance_metrics")
      .select("*")
      .eq("user_id", this.userId)
      .eq("report_id", reportId)
      .order("metric_key");

    return {
      data: (data as PerformanceMetric[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async deleteByReportId(reportId: string) {
    const { error } = await this.supabase
      .from("performance_metrics")
      .delete()
      .eq("user_id", this.userId)
      .eq("report_id", reportId);

    return { error: error?.message ?? null };
  }
}
