import {
  ClientesRepository,
  EstoqueRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listClientes() {
  const { supabase, userId } = await getDataContext();
  return new ClientesRepository(supabase, userId).findAll();
}

export async function createCliente(payload: Omit<TableInsert<"clientes">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  return new ClientesRepository(supabase, userId).create(payload);
}

export async function listOrcamentos() {
  const { supabase, userId } = await getDataContext();
  return new OrcamentosRepository(supabase, userId).findWithCliente();
}

export async function createOrcamento(
  payload: Omit<TableInsert<"orcamentos">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new OrcamentosRepository(supabase, userId).create(payload);
}

export async function updateOrcamento(
  id: string,
  payload: TableUpdate<"orcamentos">
) {
  const { supabase, userId } = await getDataContext();
  return new OrcamentosRepository(supabase, userId).update(id, payload);
}

export async function listEstoque() {
  const { supabase, userId } = await getDataContext();
  return new EstoqueRepository(supabase, userId).findAll("produto");
}

export async function listEstoqueCritico() {
  const { supabase, userId } = await getDataContext();
  return new EstoqueRepository(supabase, userId).findCritical();
}

export async function createEstoqueItem(
  payload: Omit<TableInsert<"estoque">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new EstoqueRepository(supabase, userId).create(payload);
}
