import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class ClientesRepository extends BaseRepository<"clientes"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "clientes", userId);
  }
}
