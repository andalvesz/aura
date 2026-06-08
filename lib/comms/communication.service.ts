import { getDataContext, getOptionalDataContext } from "@/lib/supabase/services/context";
import type { CommunicationLog, Json, TableInsert } from "@/types/database";
import type { CommsChannel, CommsDashboardStats, CommsStatus } from "@/utils/comms";
import { computeCommsOperationalStats } from "@/utils/comms-ops";
import { listStaleOpportunities } from "@/utils/follow-up";
import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { getGoogleAccountConnection } from "@/lib/google/token.service";
import type { Cliente, GrowthLead, Orcamento } from "@/types/database";

export async function listCommunicationLogs(limit = 50) {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { data: [] as CommunicationLog[], error: "Usuário não autenticado." };
  }

  const { data, error } = await ctx.supabase
    .from("communication_logs")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: (data ?? []) as CommunicationLog[], error: error?.message ?? null };
}

export async function createCommunicationLog(
  payload: Omit<TableInsert<"communication_logs">, "user_id">
) {
  const { supabase, userId } = await getDataContext();
  const { data, error } = await supabase
    .from("communication_logs")
    .insert({ ...payload, user_id: userId })
    .select()
    .single();

  return { data: data as CommunicationLog | null, error: error?.message ?? null };
}

export async function markCommunicationOpened(trackingToken: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { updated: false };

  const { data, error } = await ctx.supabase.rpc("mark_communication_opened", {
    p_token: trackingToken,
  });

  if (!error && data === true) {
    return { updated: true };
  }

  const { data: existing } = await ctx.supabase
    .from("communication_logs")
    .select("id, opened_at")
    .eq("tracking_token", trackingToken)
    .maybeSingle();

  if (!existing || existing.opened_at) {
    return { updated: false };
  }

  await ctx.supabase
    .from("communication_logs")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("tracking_token", trackingToken);

  return { updated: true };
}

export async function getCommsDashboardStats(
  leads: GrowthLead[],
  orcamentos: Orcamento[],
  clientes: Cliente[] = []
): Promise<CommsDashboardStats> {
  const configured = Boolean(getGoogleOAuthConfig());
  const { connection } = await getGoogleAccountConnection();
  const { data: logs } = await listCommunicationLogs(200);

  const emailsSent = logs.filter(
    (l) => l.channel === "email" && l.direction === "outbound" && l.status !== "failed"
  ).length;

  const propostasSent = logs.filter((l) => l.proposta_id && l.channel === "email").length;
  const propostasOpened = logs.filter(
    (l) => l.proposta_id && (l.status === "opened" || l.opened_at)
  ).length;

  const followUpsPending = listStaleOpportunities({
    leads,
    orcamentos,
    clientes,
  }).length;

  const operational = computeCommsOperationalStats(logs, leads, orcamentos, clientes);

  return {
    emailsSent,
    followUpsPending,
    propostasSent,
    propostasOpened,
    semResposta: operational.semResposta,
    aguardandoRetorno: operational.aguardandoRetorno,
    followUpPendente: operational.followUpPendente,
    gmailConnected: Boolean(connection?.access_token),
    gmailConfigured: configured,
  };
}

export async function logOutboundMessage(params: {
  channel: CommsChannel;
  status?: CommsStatus;
  subject?: string;
  bodyPreview?: string;
  recipient?: string;
  clienteId?: string | null;
  orcamentoId?: string | null;
  leadId?: string | null;
  propostaId?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  metadata?: Json;
}) {
  return createCommunicationLog({
    channel: params.channel,
    direction: "outbound",
    status: params.status ?? "sent",
    subject: params.subject ?? null,
    body_preview: params.bodyPreview?.slice(0, 500) ?? null,
    recipient: params.recipient ?? null,
    cliente_id: params.clienteId ?? null,
    orcamento_id: params.orcamentoId ?? null,
    lead_id: params.leadId ?? null,
    proposta_id: params.propostaId ?? null,
    gmail_message_id: params.gmailMessageId ?? null,
    gmail_thread_id: params.gmailThreadId ?? null,
    metadata: params.metadata ?? {},
  });
}
