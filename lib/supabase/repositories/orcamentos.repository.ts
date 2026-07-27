import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Orcamento } from "@/types/database";
import { WorkspaceScopedRepository } from "./workspace-scoped.repository";

export class OrcamentosRepository extends WorkspaceScopedRepository<"orcamentos"> {
  constructor(
    supabase: SupabaseClient<Database>,
    userId: string,
    workspaceId: string
  ) {
    super(supabase, "orcamentos", userId, workspaceId);
  }

  async findWithCliente() {
    const { data, error } = await this.supabase
      .from("orcamentos")
      .select("*, clientes(nome, telefone, email)")
      .eq("workspace_id", this.workspaceId)
      .order("created_at", { ascending: false });
    return { data, error: error?.message ?? null };
  }

  async findByStatus(status: string) {
    const { data, error } = await this.supabase
      .from("orcamentos")
      .select("*")
      .eq("workspace_id", this.workspaceId)
      .eq("status", status)
      .order("created_at", { ascending: false });
    return { data: (data as Orcamento[]) ?? null, error: error?.message ?? null };
  }
}
