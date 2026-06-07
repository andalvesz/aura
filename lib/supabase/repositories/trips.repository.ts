import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Trip } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class TripsRepository extends BaseRepository<"trips"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "trips", userId);
  }

  async findUpcoming(referenceDate: string) {
    const { data, error } = await this.supabase
      .from("trips")
      .select("*")
      .eq("user_id", this.userId)
      .neq("status", "cancelada")
      .gte("data_volta", referenceDate)
      .order("data_ida", { ascending: true });

    return { data: (data as Trip[]) ?? null, error: error?.message ?? null };
  }
}
