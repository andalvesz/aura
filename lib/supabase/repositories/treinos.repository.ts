import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class TreinosRepository extends BaseRepository<"treinos"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "treinos", userId);
  }
}
