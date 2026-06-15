import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OperationCenter, OperationCenterStatus } from "@/types/database";
import { BaseRepository } from "./base.repository";

const ACTIVE_STATUSES: OperationCenterStatus[] = ["draft", "preparing", "ready", "approved"];

export class OperationCenterRepository extends BaseRepository<"operation_center"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "operation_center", userId);
  }

  async findActive(): Promise<{ data: OperationCenter | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("operation_center")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", ACTIVE_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[operation-center] findActive query failed:", error.message);
    }

    return {
      data: (data as OperationCenter | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findByCeoSessionId(ceoSessionId: string) {
    const { data, error } = await this.supabase
      .from("operation_center")
      .select("*")
      .eq("user_id", this.userId)
      .eq("ceo_session_id", ceoSessionId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      data: (data as OperationCenter | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async cancelActive() {
    const { error } = await this.supabase
      .from("operation_center")
      .update({ status: "cancelled" })
      .eq("user_id", this.userId)
      .in("status", ["draft", "preparing"]);

    return { error: error?.message ?? null };
  }
}
