import { GastosRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listGastos() {
  const { supabase, userId } = await getDataContext();
  return new GastosRepository(supabase, userId).findAll("data");
}

export async function listGastosByMonth(year: number, month: number) {
  const { supabase, userId } = await getDataContext();
  return new GastosRepository(supabase, userId).findByMonth(year, month);
}

export async function createGasto(payload: Omit<TableInsert<"gastos">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  return new GastosRepository(supabase, userId).create(payload);
}

export async function updateGasto(
  id: string,
  payload: TableUpdate<"gastos">
) {
  const { supabase, userId } = await getDataContext();
  return new GastosRepository(supabase, userId).update(id, payload);
}

export async function deleteGasto(id: string) {
  const { supabase, userId } = await getDataContext();
  return new GastosRepository(supabase, userId).delete(id);
}
