import { DietaRepository, TreinosRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listTreinos() {
  const { supabase, userId } = await getDataContext();
  return new TreinosRepository(supabase, userId).findAll();
}

export async function createTreino(payload: Omit<TableInsert<"treinos">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  return new TreinosRepository(supabase, userId).create(payload);
}

export async function updateTreino(id: string, payload: TableUpdate<"treinos">) {
  const { supabase, userId } = await getDataContext();
  return new TreinosRepository(supabase, userId).update(id, payload);
}

export async function listDieta() {
  const { supabase, userId } = await getDataContext();
  return new DietaRepository(supabase, userId).findAllOrdered();
}

export async function createDietaItem(
  payload: Omit<TableInsert<"dieta">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new DietaRepository(supabase, userId).create(payload);
}
