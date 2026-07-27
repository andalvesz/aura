import {
  ClientesRepository,
  EstoqueRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import type { Orcamento, TableInsert, TableUpdate } from "@/types/database";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { requireWorkspaceContext } from "./context";
import { syncAlveszIncomeFromOrcamento } from "./finance.service";
import { awardAuraXp } from "./xp.service";

async function alveszRepos() {
  return requireWorkspaceContext();
}

export async function listClientes() {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new ClientesRepository(supabase, userId, activeWorkspaceId).findAll();
}

export async function createCliente(
  payload: Omit<TableInsert<"clientes">, "user_id" | "workspace_id">
) {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new ClientesRepository(supabase, userId, activeWorkspaceId).create(payload);
}

export async function listOrcamentos() {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new OrcamentosRepository(supabase, userId, activeWorkspaceId).findWithCliente();
}

export async function createOrcamento(
  payload: Omit<TableInsert<"orcamentos">, "user_id" | "workspace_id">
) {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new OrcamentosRepository(supabase, userId, activeWorkspaceId).create(payload);
}

export async function updateOrcamento(
  id: string,
  payload: TableUpdate<"orcamentos">
) {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  const repo = new OrcamentosRepository(supabase, userId, activeWorkspaceId);
  const previous = await repo.findById(id);
  const result = await repo.update(id, payload);

  if (!result.error && result.data) {
    const orcamento = result.data as Orcamento;
    const status = normalizeOrcamentoStatus(
      payload.status ?? orcamento.status
    );
    if (status === "fechado") {
      await syncAlveszIncomeFromOrcamento({ ...orcamento, status: "fechado" });
      if (normalizeOrcamentoStatus(previous.data?.status ?? "") !== "fechado") {
        await awardAuraXp("evento_fechado_alvesz");
      }
    }
  }

  return result;
}

export async function listEstoque() {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new EstoqueRepository(supabase, userId, activeWorkspaceId).findAll("produto");
}

export async function listEstoqueCritico() {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new EstoqueRepository(supabase, userId, activeWorkspaceId).findCritical();
}

export async function createEstoqueItem(
  payload: Omit<TableInsert<"estoque">, "user_id" | "workspace_id">
) {
  const { supabase, userId, activeWorkspaceId } = await alveszRepos();
  return new EstoqueRepository(supabase, userId, activeWorkspaceId).create(payload);
}
