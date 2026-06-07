import {
  ClientesRepository,
  EstoqueRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import type { Orcamento, TableInsert, TableUpdate } from "@/types/database";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { getDataContext } from "./context";
import { syncAlveszIncomeFromOrcamento } from "./finance.service";
import { awardAuraXp } from "./xp.service";

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
  const repo = new OrcamentosRepository(supabase, userId);
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
