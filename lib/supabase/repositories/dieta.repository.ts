import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class DietaRepository extends BaseRepository<"dieta"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "dieta", userId);
  }

  async findAllOrdered() {
    const { data, error } = await this.supabase
      .from("dieta")
      .select("*")
      .eq("user_id", this.userId)
      .order("horario", { ascending: true });
    return { data, error: error?.message ?? null };
  }
}
