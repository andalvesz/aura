import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { WorkspaceScopedRepository } from "./workspace-scoped.repository";

export class ClientesRepository extends WorkspaceScopedRepository<"clientes"> {
  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string
  ) {
    super(supabase, "clientes", userId, workspaceId);
  }
}
