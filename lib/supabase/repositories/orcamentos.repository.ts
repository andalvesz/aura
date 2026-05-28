import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Orcamento } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class OrcamentosRepository extends BaseRepository<"orcamentos"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "orcamentos", userId);
  }

  async findWithCliente() {
    const { data, error } = await this.supabase
      .from("orcamentos")
      .select("*, clientes(nome, telefone, email)")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    return { data, error: error?.message ?? null };
  }

  async findByStatus(status: string) {
    const { data, error } = await this.supabase
      .from("orcamentos")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    return { data: (data as Orcamento[]) ?? null, error: error?.message ?? null };
  }
}
