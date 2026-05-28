import { LeadsRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getDataContext } from "./context";

export async function listLeads() {
  const { supabase, userId } = await getDataContext();
  return new LeadsRepository(supabase, userId).findAll();
}

export async function listLeadsToday() {
  const { supabase, userId } = await getDataContext();
  return new LeadsRepository(supabase, userId).findToday();
}

export async function listLeadsByStatus(status: string) {
  const { supabase, userId } = await getDataContext();
  return new LeadsRepository(supabase, userId).findByStatus(status);
}

export async function createLead(payload: Omit<TableInsert<"leads">, "user_id">) {
  const { supabase, userId } = await getDataContext();
  return new LeadsRepository(supabase, userId).create(payload);
}

export async function updateLead(id: string, payload: TableUpdate<"leads">) {
  const { supabase, userId } = await getDataContext();
  return new LeadsRepository(supabase, userId).update(id, payload);
}
