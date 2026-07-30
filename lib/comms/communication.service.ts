import { getDataContext, getOptionalDataContext } from "@/lib/supabase/services/context";
import {
  validateCommunicationLogRefs,
  type WorkspaceRefCheck,
  type PersonalRefCheck,
} from "@/lib/workspace/communication-log-refs";
import type { CommunicationLog, Json, TableInsert } from "@/types/database";
import type { CommsChannel, CommsDashboardStats, CommsStatus } from "@/utils/comms";
import { computeCommsOperationalStats } from "@/utils/comms-ops";
import { listStaleOpportunities } from "@/utils/follow-up";
import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { getGoogleAccountConnection } from "@/lib/google/token.service";
import type { Cliente, GrowthLead, Orcamento } from "@/types/database";

async function resolveWorkspaceMembership(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

async function loadWorkspaceRef(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  table: WorkspaceRefCheck["table"],
  id: string | null | undefined
): Promise<WorkspaceRefCheck | null> {
  if (!id) return null;
  const { data } = await supabase.from(table).select("id, workspace_id").eq("id", id).maybeSingle();
  if (!data) {
    return { table, id, workspaceId: null };
  }
  return {
    table,
    id,
    workspaceId: (data as { workspace_id?: string | null }).workspace_id ?? null,
  };
}

async function loadGrowthLeadRef(
  supabase: Awaited<ReturnType<typeof getDataContext>>["supabase"],
  id: string | null | undefined
): Promise<PersonalRefCheck | null> {
  if (!id) return null;
  const { data } = await supabase
    .from("growth_leads")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    return { table: "growth_leads", id, ownerUserId: null };
  }
  return {
    table: "growth_leads",
    id,
    ownerUserId: data.user_id ?? null,
  };
}

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

  const membershipCache = new Map<string, boolean>();
  const isActiveMemberOf = (workspaceId: string) => {
    const cached = membershipCache.get(workspaceId);
    return cached === true;
  };

  const cliente = await loadWorkspaceRef(supabase, "clientes", payload.cliente_id);
  const orcamento = await loadWorkspaceRef(supabase, "orcamentos", payload.orcamento_id);
  const proposta = await loadWorkspaceRef(supabase, "alvesz_propostas", payload.proposta_id);

  const workspaceIds = [
    cliente?.workspaceId,
    orcamento?.workspaceId,
    proposta?.workspaceId,
  ].filter((id): id is string => Boolean(id));

  for (const ws of workspaceIds) {
    if (!membershipCache.has(ws)) {
      membershipCache.set(ws, await resolveWorkspaceMembership(supabase, userId, ws));
    }
  }

  let growthLead: PersonalRefCheck | null = null;
  let leadWorkspace: WorkspaceRefCheck | null = null;
  if (payload.lead_id) {
    growthLead = await loadGrowthLeadRef(supabase, payload.lead_id);
    leadWorkspace = await loadWorkspaceRef(supabase, "leads", payload.lead_id);
    const leadWsId = leadWorkspace?.workspaceId;
    if (leadWsId && !membershipCache.has(leadWsId)) {
      membershipCache.set(
        leadWsId,
        await resolveWorkspaceMembership(supabase, userId, leadWsId)
      );
    }
  }

  const validation = validateCommunicationLogRefs({
    actorUserId: userId,
    isActiveMemberOf: (ws) => membershipCache.get(ws) === true,
    cliente,
    orcamento,
    proposta,
  });

  if (!validation.ok) {
    return {
      data: null as CommunicationLog | null,
      error: `Referência de workspace inválida: ${validation.violations.join(", ")}`,
    };
  }

  if (payload.lead_id) {
    const growthOk = growthLead?.ownerUserId === userId;
    const leadWsId = leadWorkspace?.workspaceId;
    const leadOk = Boolean(leadWsId) && membershipCache.get(leadWsId!) === true;
    if (!growthOk && !leadOk) {
      return {
        data: null as CommunicationLog | null,
        error: "Referência de workspace inválida: lead_inaccessible",
      };
    }
  }

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
