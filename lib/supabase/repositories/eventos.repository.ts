import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Evento } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class EventosRepository extends BaseRepository<"eventos"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "eventos", userId);
  }

  async findUpcoming(limit = 10) {
    const { data, error } = await this.supabase
      .from("eventos")
      .select("*")
      .eq("user_id", this.userId)
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true })
      .limit(limit);
    return { data: (data as Evento[]) ?? null, error: error?.message ?? null };
  }
}
