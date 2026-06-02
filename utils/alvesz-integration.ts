import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Cliente,
  Database,
  Evento,
  GrowthGoal,
  GrowthLead,
  Orcamento,
} from "@/types/database";
import { computeGrowthLeadMetrics } from "@/utils/growth";
import { buildEventoDateTime } from "@/utils/calendar";

type Client = SupabaseClient<Database>;

export const ORCAMENTO_STATUSES = [
  { id: "rascunho", label: "Rascunho" },
  { id: "enviado", label: "Enviado" },
  { id: "negociacao", label: "Negociação" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
] as const;

export type OrcamentoStatus = (typeof ORCAMENTO_STATUSES)[number]["id"];

export function getOrcamentoStatusLabel(status: string) {
  return ORCAMENTO_STATUSES.find((s) => s.id === status)?.label ?? status;
}

export function normalizeOrcamentoStatus(status: string): OrcamentoStatus {
  const map: Record<string, OrcamentoStatus> = {
    rascunho: "rascunho",
    pendente: "enviado",
    enviado: "enviado",
    negociacao: "negociacao",
    fechado: "fechado",
    perdido: "perdido",
    cancelado: "perdido",
  };
  return map[status] ?? "rascunho";
}

export async function createGrowthLeadFromOrcamento(
  supabase: Client,
  orcamento: Orcamento,
  cliente: Cliente | null
): Promise<{ data: GrowthLead | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Sessão expirada." };

  const nome = cliente?.nome ?? `Orçamento ${orcamento.tipo_evento}`;
  const { data, error } = await supabase
    .from("growth_leads")
    .insert({
      user_id: user.id,
      nome,
      contato: cliente?.telefone ?? null,
      origem: "alvesz",
      canal: cliente?.instagram ? "instagram" : "whatsapp",
      vertical: "alvesz",
      status: "proposta",
      valor_potencial: Number(orcamento.valor_total),
      observacoes: `Lead gerado do orçamento: ${orcamento.tipo_evento}`,
      external_id: `orcamento:${orcamento.id}`,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  if (data) {
    await supabase
      .from("orcamentos")
      .update({ growth_lead_id: data.id })
      .eq("id", orcamento.id);
  }

  return { data: data as GrowthLead, error: null };
}

export async function syncGrowthReceitaAtual(supabase: Client): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: leads } = await supabase
    .from("growth_leads")
    .select("*")
    .eq("user_id", user.id);

  const { data: orcamentos } = await supabase
    .from("orcamentos")
    .select("valor_total, status")
    .eq("user_id", user.id)
    .eq("status", "fechado");

  const leadReceita = computeGrowthLeadMetrics((leads ?? []) as GrowthLead[]).receita;
  const orcamentoReceita = (orcamentos ?? []).reduce(
    (s, o) => s + Number(o.valor_total),
    0
  );
  const receita_atual = leadReceita + orcamentoReceita;

  const mes = new Date().toISOString().slice(0, 7) + "-01";
  const { data: goals } = await supabase
    .from("growth_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("mes_referencia", mes)
    .limit(1);

  const goal = (goals?.[0] ?? null) as GrowthGoal | null;
  if (goal) {
    await supabase
      .from("growth_goals")
      .update({ receita_atual })
      .eq("id", goal.id);
  }
}

export async function syncGrowthLeadOnOrcamentoStatus(
  supabase: Client,
  orcamento: Orcamento,
  newStatus: OrcamentoStatus
): Promise<void> {
  if (orcamento.growth_lead_id) {
    const leadStatus =
      newStatus === "fechado"
        ? "fechado"
        : newStatus === "perdido"
          ? "perdido"
          : newStatus === "negociacao"
            ? "negociacao"
            : "proposta";

    await supabase
      .from("growth_leads")
      .update({ status: leadStatus, valor_potencial: Number(orcamento.valor_total) })
      .eq("id", orcamento.growth_lead_id);
  }

  if (newStatus === "fechado") {
    await syncGrowthReceitaAtual(supabase);
  }
}

export async function createCalendarFromAlveszEvento(
  supabase: Client,
  payload: {
    titulo: string;
    data_evento: string;
    local: string | null;
    clienteNome?: string;
  }
): Promise<{ data: Evento | null; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Sessão expirada." };

  const titulo = payload.clienteNome
    ? `${payload.titulo} — ${payload.clienteNome}`
    : payload.titulo;

  const { data, error } = await supabase
    .from("eventos")
    .insert({
      user_id: user.id,
      titulo,
      descricao: payload.local ? `Local: ${payload.local}` : null,
      data_inicio: buildEventoDateTime(payload.data_evento, "09:00"),
      local: payload.local,
      tipo: "evento",
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as Evento, error: null };
}
