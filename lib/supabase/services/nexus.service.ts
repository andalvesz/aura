import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { listEventos } from "@/lib/supabase/services/eventos.service";
import { OrcamentosRepository } from "@/lib/supabase/repositories";
import {
  GrowthGoalsRepository,
  GrowthLeadsRepository,
  GrowthMissionsRepository,
} from "@/lib/supabase/repositories/growth.repository";
import type { Cliente, GrowthGoal, GrowthLead, GrowthMission, Orcamento } from "@/types/database";
import { getCurrentMonthReference } from "@/utils/growth";
import {
  buildNexusAlveszContext,
  buildNexusAlveszUnavailableContext,
  buildNexusCalendarContext,
  buildNexusCalendarUnavailableContext,
  buildNexusDayContext,
  buildNexusExecutiveDashboardContext,
  type NexusModuleData,
  type OrcamentoWithCliente,
} from "@/utils/nexus";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

type SafeLoadResult<T> = {
  data: T;
  unavailable: boolean;
  error: string | null;
};

async function safeLoad<T>(
  loader: () => Promise<{ data: T | null; error: string | null }>,
  fallback: T
): Promise<SafeLoadResult<T>> {
  try {
    const { data, error } = await loader();

    if (error) {
      if (isMissingSupabaseTableError(error)) {
        return { data: fallback, unavailable: true, error: null };
      }
      console.warn("[nexus] Erro ao carregar dados:", error);
      return { data: fallback, unavailable: false, error };
    }

    return { data: data ?? fallback, unavailable: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { data: fallback, unavailable: true, error: null };
    }
    console.warn("[nexus] Exceção ao carregar dados:", message);
    return { data: fallback, unavailable: false, error: message };
  }
}

function attachClientesToOrcamentos(
  orcamentos: Orcamento[],
  clientes: Cliente[]
): OrcamentoWithCliente[] {
  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente]));

  return orcamentos.map((orcamento) => ({
    ...orcamento,
    clientes: orcamento.cliente_id
      ? (clientesById.get(orcamento.cliente_id) ?? null)
      : null,
  }));
}

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
    clientesLoad,
    orcamentosLoad,
    eventosLoad,
    leadsLoad,
    goalLoad,
    missionsLoad,
  ] = await Promise.all([
    safeLoad(() => listClientes(), []),
    safeLoad(
      () => new OrcamentosRepository(ctx.supabase, ctx.userId).findAll(),
      []
    ),
    safeLoad(() => listEventos(), []),
    safeLoad(
      () => new GrowthLeadsRepository(ctx.supabase, ctx.userId).findAll(),
      []
    ),
    safeLoad(
      () =>
        new GrowthGoalsRepository(ctx.supabase, ctx.userId).findCurrentMonth(monthRef),
      null
    ),
    safeLoad(
      () =>
        new GrowthMissionsRepository(ctx.supabase, ctx.userId).findAll("mission_date"),
      []
    ),
  ]);

  const alveszUnavailable = clientesLoad.unavailable && orcamentosLoad.unavailable;
  const calendarUnavailable = eventosLoad.unavailable;

  const blockingError =
    leadsLoad.error ??
    missionsLoad.error ??
    goalLoad.error ??
    clientesLoad.error ??
    orcamentosLoad.error ??
    eventosLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return { data: null, error: blockingError };
  }

  const clientes = clientesLoad.data;
  const orcamentos = attachClientesToOrcamentos(orcamentosLoad.data, clientes);

  return {
    data: {
      clientes,
      orcamentos,
      eventos: eventosLoad.data,
      leads: leadsLoad.data as GrowthLead[],
      goal: goalLoad.data as GrowthGoal | null,
      missions: missionsLoad.data as GrowthMission[],
      alveszAvailable: !alveszUnavailable,
      calendarAvailable: !calendarUnavailable,
    },
    error: null,
  };
}

function hasAlveszRecords(data: NexusModuleData): boolean {
  return data.clientes.length > 0 || data.orcamentos.length > 0;
}

export async function getNexusAlveszMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadNexusModuleData();
  if (error || !data) {
    return { context: null, error };
  }

  if (!data.alveszAvailable && !hasAlveszRecords(data)) {
    return { context: buildNexusAlveszUnavailableContext(), error: null };
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

  if (!data.calendarAvailable && data.eventos.length === 0) {
    return { context: buildNexusCalendarUnavailableContext(), error: null };
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
