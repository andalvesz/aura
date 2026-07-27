import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstoqueItem } from "@/types/database";
import { WorkspaceScopedRepository } from "./workspace-scoped.repository";

export class EstoqueRepository extends WorkspaceScopedRepository<"estoque"> {
  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string
  ) {
    super(supabase, "estoque", userId, workspaceId);
  }

  async findCritical() {
    const { data, error } = await this.supabase
      .from("estoque")
      .select("*")
      .eq("workspace_id", this.workspaceId)
      .order("quantidade", { ascending: true });
    const items = (data as EstoqueItem[]) ?? [];
    return {
      data: items.filter((i) => i.quantidade <= i.minimo_alerta),
      error: error?.message ?? null,
    };
  }
}
