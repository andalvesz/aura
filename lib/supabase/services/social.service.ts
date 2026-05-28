import { ConteudosRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listConteudos() {
  const { supabase, userId } = await getDataContext();
  return new ConteudosRepository(supabase, userId).findAll();
}

export async function listConteudosByPlataforma(plataforma: string) {
  const { supabase, userId } = await getDataContext();
  return new ConteudosRepository(supabase, userId).findByPlataforma(plataforma);
}

export async function createConteudo(
  payload: Omit<TableInsert<"conteudos">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new ConteudosRepository(supabase, userId).create(payload);
}

export async function updateConteudo(
  id: string,
  payload: TableUpdate<"conteudos">
) {
  const { supabase, userId } = await getDataContext();
  return new ConteudosRepository(supabase, userId).update(id, payload);
}
