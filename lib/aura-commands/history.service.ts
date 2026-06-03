import { getOptionalDataContext } from "@/lib/supabase/services/context";
import type { Json } from "@/types/database";
import type {
  AuraCommandHistoryEntry,
  AuraCommandPayload,
  PendingAuraCommand,
} from "@/utils/aura-commands";

export async function logAuraCommandHistory(params: {
  pending: PendingAuraCommand;
  result: AuraCommandPayload | null;
  status: "success" | "error";
  errorMessage?: string | null;
}): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  await ctx.supabase.from("aura_command_history").insert({
    user_id: ctx.userId,
    command_id: params.pending.commandId,
    module: params.pending.module,
    summary: params.pending.summary,
    payload: params.pending.payload as Json,
    result: (params.result ?? null) as Json,
    status: params.status,
    error_message: params.errorMessage ?? null,
  });
}

export async function listAuraCommandHistory(limit = 15): Promise<{
  entries: AuraCommandHistoryEntry[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { entries: [], error: "Usuário não autenticado." };
  }

  const { data, error } = await ctx.supabase
    .from("aura_command_history")
    .select(
      "id, command_id, module, summary, payload, result, status, error_message, created_at"
    )
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { entries: [], error: error.message };
  }

  return {
    entries: (data ?? []) as AuraCommandHistoryEntry[],
    error: null,
  };
}
