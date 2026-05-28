import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserScopedTable } from "@/types/database";

/** Acesso tipado no servidor; no client usa cast leve para CRUD genérico */
export function queryTable(
  supabase: SupabaseClient<Database>,
  table: UserScopedTable
) {
  return supabase.from(table);
}
