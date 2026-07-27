import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TableRow, WorkspaceScopedTable } from "@/types/database";

/** Load workspace rows by membership scope (not creator user_id). */
export async function findWorkspaceRows<T extends WorkspaceScopedTable>(
  supabase: SupabaseClient<Database>,
  table: T,
  workspaceId: string | null | undefined,
  orderColumn = "created_at"
): Promise<{ data: TableRow<T>[] | null; error: string | null }> {
  if (!workspaceId) {
    return { data: [], error: null };
  }
  const { data, error } = await (supabase.from(table) as ReturnType<
    SupabaseClient<Database>["from"]
  >)
    .select("*")
    .eq("workspace_id" as never, workspaceId)
    .order(orderColumn as never, { ascending: false });
  return {
    data: (data as TableRow<T>[] | null) ?? null,
    error: error?.message ?? null,
  };
}
