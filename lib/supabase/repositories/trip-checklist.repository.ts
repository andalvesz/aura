import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TripChecklistItem } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class TripChecklistRepository extends BaseRepository<"trip_checklist_items"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "trip_checklist_items", userId);
  }

  async findByTrip(tripId: string) {
    const { data, error } = await this.supabase
      .from("trip_checklist_items")
      .select("*")
      .eq("user_id", this.userId)
      .eq("trip_id", tripId)
      .order("ordem", { ascending: true });

    return {
      data: (data as TripChecklistItem[]) ?? null,
      error: error?.message ?? null,
    };
  }
}
