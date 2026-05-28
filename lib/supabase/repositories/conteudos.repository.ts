import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Conteudo } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ConteudosRepository extends BaseRepository<"conteudos"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "conteudos", userId);
  }

  async findByPlataforma(plataforma: string) {
    const { data, error } = await this.supabase
      .from("conteudos")
      .select("*")
      .eq("user_id", this.userId)
      .eq("plataforma", plataforma)
      .order("created_at", { ascending: false });
    return { data: (data as Conteudo[]) ?? null, error: error?.message ?? null };
  }
}
