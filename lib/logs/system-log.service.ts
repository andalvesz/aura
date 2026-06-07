import type { Json, SystemLog, SystemLogTipo } from "@/types/database";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";

export type RecordSystemLogInput = {
  tipo: SystemLogTipo;
  modulo: string;
  mensagem: string;
  detalhes?: Json | Record<string, unknown> | null;
  userId?: string;
};

export type ListSystemLogsFilters = {
  tipo?: SystemLogTipo | "all";
  modulo?: string | "all";
  from?: string;
  to?: string;
  limit?: number;
};

export async function recordSystemLogInternal(
  input: RecordSystemLogInput
): Promise<{ error: string | null }> {
  let ctx = null;

  if (input.userId) {
    const optional = await getOptionalDataContext();
    if (optional?.userId === input.userId) {
      ctx = optional;
    }
  }

  if (!ctx) {
    ctx = await getOptionalDataContext();
  }

  if (!ctx) {
    return { error: "Usuário não autenticado." };
  }

  const { error } = await ctx.supabase.from("system_logs").insert({
    user_id: ctx.userId,
    tipo: input.tipo,
    modulo: input.modulo,
    mensagem: input.mensagem.slice(0, 2000),
    detalhes: (input.detalhes ?? null) as Json | null,
  });

  if (error?.message && isMissingSupabaseTableError(error.message)) {
    return { error: null };
  }

  return { error: error?.message ?? null };
}

export async function listSystemLogs(
  filters: ListSystemLogsFilters = {}
): Promise<{ logs: SystemLog[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { logs: [], error: "Usuário não autenticado." };
  }

  let query = ctx.supabase
    .from("system_logs")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 500);

  if (filters.tipo && filters.tipo !== "all") {
    query = query.eq("tipo", filters.tipo);
  }
  if (filters.modulo && filters.modulo !== "all") {
    query = query.eq("modulo", filters.modulo);
  }
  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error?.message && isMissingSupabaseTableError(error.message)) {
    return {
      logs: [],
      error:
        "Tabela system_logs ausente. Execute supabase/migrations/20250607180000_system_logs.sql",
    };
  }

  return {
    logs: (data as SystemLog[] | null) ?? [],
    error: error?.message ?? null,
  };
}

export async function clearSystemLogs(filters?: {
  tipo?: SystemLogTipo | "all";
  modulo?: string | "all";
}): Promise<{ deleted: number; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { deleted: 0, error: "Usuário não autenticado." };
  }

  let query = ctx.supabase.from("system_logs").delete().eq("user_id", ctx.userId);

  if (filters?.tipo && filters.tipo !== "all") {
    query = query.eq("tipo", filters.tipo);
  }
  if (filters?.modulo && filters.modulo !== "all") {
    query = query.eq("modulo", filters.modulo);
  }

  const { data, error } = await query.select("id");

  if (error?.message && isMissingSupabaseTableError(error.message)) {
    return { deleted: 0, error: "Tabela system_logs ausente." };
  }

  return { deleted: data?.length ?? 0, error: error?.message ?? null };
}
