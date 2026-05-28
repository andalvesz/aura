import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstoqueItem } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class EstoqueRepository extends BaseRepository<"estoque"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "estoque", userId);
  }

  async findCritical() {
    const { data, error } = await this.supabase
      .from("estoque")
      .select("*")
      .eq("user_id", this.userId)
      .order("quantidade", { ascending: true });
    const items = (data as EstoqueItem[]) ?? [];
    return {
      data: items.filter((i) => i.quantidade <= i.minimo_alerta),
      error: error?.message ?? null,
    };
  }
}
