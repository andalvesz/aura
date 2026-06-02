import {
  GrowthActionsRepository,
  GrowthAnalysesRepository,
  GrowthContentMemoryRepository,
  GrowthGoalsRepository,
  GrowthMissionsRepository,
  GrowthProfilesRepository,
  GrowthLeadsRepository,
} from "@/lib/supabase/repositories/growth.repository";
import type {
  GrowthContentMemory,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  TableInsert,
  TableUpdate,
} from "@/types/database";
import {
  analyzeGrowthLeadContentInsights,
  buildExecutiveDayContext,
  buildGrowthLeadsMentorContext,
  buildStrategicMemoryContext,
  getCurrentMonthReference,
} from "@/utils/growth";
import { getDataContext, getOptionalDataContext } from "./context";

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

export async function getGrowthLeadsMentorContext(actionId?: string): Promise<{
  context: string | null;
  error: string | null;
  leadCount: number;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado.", leadCount: 0 };
  }

  const { data, error } = await new GrowthLeadsRepository(
    ctx.supabase,
    ctx.userId
  ).findAll();

  if (error) {
    return { context: null, error, leadCount: 0 };
  }

  const leads = data ?? [];

  return {
    context: buildGrowthLeadsMentorContext(leads, actionId),
    error: null,
    leadCount: leads.length,
  };
}

export async function getGrowthExecutiveMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  const monthRef = getCurrentMonthReference();

  const [leadsResult, goalResult, missionsResult] = await Promise.all([
    new GrowthLeadsRepository(ctx.supabase, ctx.userId).findAll(),
    new GrowthGoalsRepository(ctx.supabase, ctx.userId).findCurrentMonth(monthRef),
    new GrowthMissionsRepository(ctx.supabase, ctx.userId).findAll("mission_date"),
  ]);

  if (leadsResult.error) {
    return { context: null, error: leadsResult.error };
  }
  if (missionsResult.error) {
    return { context: null, error: missionsResult.error };
  }

  return {
    context: buildExecutiveDayContext({
      leads: (leadsResult.data ?? []) as GrowthLead[],
      goal: (goalResult.data ?? null) as GrowthGoal | null,
      missions: (missionsResult.data ?? []) as GrowthMission[],
    }),
    error: null,
  };
}

export async function recordContentSuggestion(params: {
  actionId: string;
  resumo?: string;
}): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const { data: leads } = await new GrowthLeadsRepository(
    ctx.supabase,
    ctx.userId
  ).findAll();

  const insights = analyzeGrowthLeadContentInsights((leads ?? []) as GrowthLead[]);

  await new GrowthContentMemoryRepository(ctx.supabase, ctx.userId).create({
    action_id: params.actionId,
    nicho: insights.maiorDemanda,
    resumo: params.resumo?.slice(0, 500) ?? null,
  });
}

export async function getGrowthStrategicMemoryMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  const [leadsResult, memoryResult, missionsResult] = await Promise.all([
    new GrowthLeadsRepository(ctx.supabase, ctx.userId).findAll(),
    new GrowthContentMemoryRepository(ctx.supabase, ctx.userId).findAll("created_at"),
    new GrowthMissionsRepository(ctx.supabase, ctx.userId).findAll("mission_date"),
  ]);

  if (leadsResult.error) {
    return { context: null, error: leadsResult.error };
  }
  if (memoryResult.error) {
    return { context: null, error: memoryResult.error };
  }
  if (missionsResult.error) {
    return { context: null, error: missionsResult.error };
  }

  return {
    context: buildStrategicMemoryContext({
      leads: (leadsResult.data ?? []) as GrowthLead[],
      contentMemory: (memoryResult.data ?? []) as GrowthContentMemory[],
      missions: (missionsResult.data ?? []) as GrowthMission[],
    }),
    error: null,
  };
}
