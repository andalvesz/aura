import {
  ClientesRepository,
  EventosRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import {
  GrowthGoalsRepository,
  GrowthLeadsRepository,
  GrowthMissionsRepository,
} from "@/lib/supabase/repositories/growth.repository";
import type { GrowthGoal, GrowthLead, GrowthMission } from "@/types/database";
import {
  buildNexusAlveszContext,
  buildNexusCalendarContext,
  buildNexusDayContext,
  buildNexusExecutiveDashboardContext,
  type NexusModuleData,
  type OrcamentoWithCliente,
} from "@/utils/nexus";
import { getCurrentMonthReference } from "@/utils/growth";
import { getOptionalDataContext } from "./context";

async function loadNexusModuleData(): Promise<{
  data: NexusModuleData | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { data: null, error: "Usuário não autenticado." };
  }

  const monthRef = getCurrentMonthReference();

  const [
    clientesResult,
    orcamentosResult,
    eventosResult,
    leadsResult,
    goalResult,
    missionsResult,
  ] = await Promise.all([
    new ClientesRepository(ctx.supabase, ctx.userId).findAll(),
    new OrcamentosRepository(ctx.supabase, ctx.userId).findAll(),
    new EventosRepository(ctx.supabase, ctx.userId).findAll(),
    new GrowthLeadsRepository(ctx.supabase, ctx.userId).findAll(),
    new GrowthGoalsRepository(ctx.supabase, ctx.userId).findCurrentMonth(monthRef),
    new GrowthMissionsRepository(ctx.supabase, ctx.userId).findAll("mission_date"),
  ]);

  const firstError =
    clientesResult.error ??
    orcamentosResult.error ??
    eventosResult.error ??
    leadsResult.error ??
    missionsResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const clientes = clientesResult.data ?? [];
  const clientesById = new Map(clientes.map((c) => [c.id, c]));
  const orcamentos: OrcamentoWithCliente[] = (orcamentosResult.data ?? []).map(
    (orcamento) => ({
      ...orcamento,
      clientes: orcamento.cliente_id
        ? clientesById.get(orcamento.cliente_id) ?? null
        : null,
    })
  );

  return {
    data: {
      clientes,
      orcamentos,
      eventos: eventosResult.data ?? [],
      leads: (leadsResult.data ?? []) as GrowthLead[],
      goal: (goalResult.data ?? null) as GrowthGoal | null,
      missions: (missionsResult.data ?? []) as GrowthMission[],
    },
    error: null,
  };
}

export async function getNexusAlveszMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadNexusModuleData();
  if (error || !data) {
    return { context: null, error };
  }
  return { context: buildNexusAlveszContext(data), error: null };
}

export async function getNexusCalendarMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadNexusModuleData();
  if (error || !data) {
    return { context: null, error };
  }
  return { context: buildNexusCalendarContext(data), error: null };
}

export async function getNexusExecutiveDashboardMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadNexusModuleData();
  if (error || !data) {
    return { context: null, error };
  }
  return { context: buildNexusExecutiveDashboardContext(data), error: null };
}

export async function getNexusDayMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadNexusModuleData();
  if (error || !data) {
    return { context: null, error };
  }
  return { context: buildNexusDayContext(data), error: null };
}
