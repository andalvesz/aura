import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Gasto } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class GastosRepository extends BaseRepository<"gastos"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "gastos", userId);
  }

  async findByMonth(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;
    const { data, error } = await this.supabase
      .from("gastos")
      .select("*")
      .eq("user_id", this.userId)
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: false });
    return { data: (data as Gasto[]) ?? null, error: error?.message ?? null };
  }
}
