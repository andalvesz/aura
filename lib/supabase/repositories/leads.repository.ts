import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Lead } from "@/types/database";
import { WorkspaceScopedRepository } from "./workspace-scoped.repository";

export class LeadsRepository extends WorkspaceScopedRepository<"leads"> {
  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string
  ) {
    super(supabase, "leads", userId, workspaceId);
  }

  async findByStatus(status: string) {
    const { data, error } = await this.supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", this.workspaceId)
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
      .eq("workspace_id", this.workspaceId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    return { data: (data as Lead[]) ?? null, error: error?.message ?? null };
  }
}
