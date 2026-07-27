import { LeadsRepository } from "@/lib/supabase/repositories";
import type { TableInsert, TableUpdate } from "@/types/database";
import { requireWorkspaceContext } from "./context";

export async function listLeads() {
  const { supabase, userId, activeWorkspaceId } = await requireWorkspaceContext();
  return new LeadsRepository(supabase, userId, activeWorkspaceId).findAll();
}

export async function listLeadsToday() {
  const { supabase, userId, activeWorkspaceId } = await requireWorkspaceContext();
  return new LeadsRepository(supabase, userId, activeWorkspaceId).findToday();
}

export async function listLeadsByStatus(status: string) {
  const { supabase, userId, activeWorkspaceId } = await requireWorkspaceContext();
  return new LeadsRepository(supabase, userId, activeWorkspaceId).findByStatus(status);
}

export async function createLead(
  payload: Omit<TableInsert<"leads">, "user_id" | "workspace_id">
) {
  const { supabase, userId, activeWorkspaceId } = await requireWorkspaceContext();
  return new LeadsRepository(supabase, userId, activeWorkspaceId).create(payload);
}

export async function updateLead(id: string, payload: TableUpdate<"leads">) {
  const { supabase, userId, activeWorkspaceId } = await requireWorkspaceContext();
  return new LeadsRepository(supabase, userId, activeWorkspaceId).update(id, payload);
}
