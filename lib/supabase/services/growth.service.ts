import {
  GrowthActionsRepository,
  GrowthAnalysesRepository,
  GrowthGoalsRepository,
  GrowthMissionsRepository,
  GrowthProfilesRepository,
  GrowthLeadsRepository,
} from "@/lib/supabase/repositories/growth.repository";
import type { TableInsert, TableUpdate } from "@/types/database";
import { getCurrentMonthReference } from "@/utils/growth";
import { getDataContext } from "./context";

export async function listGrowthGoals() {
  const { supabase, userId } = await getDataContext();
  return new GrowthGoalsRepository(supabase, userId).findAll("mes_referencia");
}

export async function getCurrentGrowthGoal() {
  const { supabase, userId } = await getDataContext();
  return new GrowthGoalsRepository(supabase, userId).findCurrentMonth(
    getCurrentMonthReference()
  );
}

export async function upsertGrowthGoal(
  payload: Omit<TableInsert<"growth_goals">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  const repo = new GrowthGoalsRepository(supabase, userId);
  const mesReferencia = payload.mes_referencia ?? getCurrentMonthReference();
  const existing = await repo.findCurrentMonth(mesReferencia);
  if (existing.data) {
    return repo.update(existing.data.id, { ...payload, mes_referencia: mesReferencia });
  }
  return repo.create({ ...payload, mes_referencia: mesReferencia });
}

export async function listGrowthMissions() {
  const { supabase, userId } = await getDataContext();
  return new GrowthMissionsRepository(supabase, userId).findAll("mission_date");
}

export async function createGrowthMission(
  payload: Omit<TableInsert<"growth_missions">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthMissionsRepository(supabase, userId).create(payload);
}

export async function updateGrowthMission(
  id: string,
  payload: TableUpdate<"growth_missions">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthMissionsRepository(supabase, userId).update(id, payload);
}

export async function listGrowthActions() {
  const { supabase, userId } = await getDataContext();
  return new GrowthActionsRepository(supabase, userId).findAll("vertical");
}

export async function listGrowthProfiles() {
  const { supabase, userId } = await getDataContext();
  return new GrowthProfilesRepository(supabase, userId).findAll();
}

export async function createGrowthProfile(
  payload: Omit<TableInsert<"growth_profiles">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthProfilesRepository(supabase, userId).create(payload);
}

export async function listGrowthAnalyses() {
  const { supabase, userId } = await getDataContext();
  return new GrowthAnalysesRepository(supabase, userId).findAll();
}

export async function createGrowthAnalysis(
  payload: Omit<TableInsert<"growth_analyses">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthAnalysesRepository(supabase, userId).create(payload);
}

export async function listGrowthLeads() {
  const { supabase, userId } = await getDataContext();
  return new GrowthLeadsRepository(supabase, userId).findAll();
}

export async function createGrowthLead(
  payload: Omit<TableInsert<"growth_leads">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthLeadsRepository(supabase, userId).create(payload);
}

export async function updateGrowthLead(
  id: string,
  payload: TableUpdate<"growth_leads">
) {
  const { supabase, userId } = await getDataContext();
  return new GrowthLeadsRepository(supabase, userId).update(id, payload);
}
