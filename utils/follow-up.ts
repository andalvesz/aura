import type { Cliente, GrowthLead, Orcamento } from "@/types/database";
import { getOrcamentoStatusLabel, normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { buildEventoDateTime } from "@/utils/calendar";
import { formatBRL, formatDate } from "@/utils/format";
import {
  GROWTH_LEAD_ACTIVE_STATUSES,
  getGrowthLeadStatusLabel,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";

export const FOLLOW_UP_IDLE_THRESHOLDS = [3, 7, 14] as const;
export type FollowUpIdleTier = (typeof FOLLOW_UP_IDLE_THRESHOLDS)[number];

export type FollowUpChannel = "whatsapp" | "instagram" | "email";

export type FollowUpContext = {
  nome: string;
  tipoEvento: string;
  valor: number;
  statusLabel: string;
  idleDays: number;
  idleTier: FollowUpIdleTier | null;
  historico: string;
  leadId: string | null;
  orcamentoId: string | null;
  canal: GrowthLead["canal"] | null;
  telefone: string | null;
};

export type StaleOpportunity = {
  context: FollowUpContext;
  lead: GrowthLead | null;
  orcamento: Orcamento | null;
  priority: number;
};

export function daysSinceContact(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(
    0,
    Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function getFollowUpIdleTier(idleDays: number): FollowUpIdleTier | null {
  if (idleDays >= 14) return 14;
  if (idleDays >= 7) return 7;
  if (idleDays >= 3) return 3;
  return null;
}

export function getFollowUpTierLabel(tier: FollowUpIdleTier): string {
  if (tier === 14) return "14+ dias sem contato";
  if (tier === 7) return "7+ dias sem contato";
  return "3+ dias sem contato";
}

function extractTipoEventoFromLead(lead: GrowthLead): string {
  const obs = lead.observacoes ?? "";
  const match = obs.match(/orçamento:\s*(.+)/i);
  if (match?.[1]) return match[1].trim();
  if (lead.vertical === "alvesz") return "Evento Alvesz Experience";
  if (lead.vertical === "consorcios") return "Consórcio";
  if (lead.vertical === "marca_pessoal") return "Marca pessoal";
  return "Oportunidade comercial";
}

export function findOrcamentoForLead(
  lead: GrowthLead,
  orcamentos: Orcamento[]
): Orcamento | null {
  if (!lead.external_id?.startsWith("orcamento:")) return null;
  const id = lead.external_id.slice("orcamento:".length);
  return orcamentos.find((o) => o.id === id) ?? null;
}

export function buildFollowUpContextFromLead(
  lead: GrowthLead,
  orcamento: Orcamento | null
): FollowUpContext {
  const idleDays = daysSinceContact(lead.updated_at);
  const tipoEvento =
    orcamento?.tipo_evento ?? extractTipoEventoFromLead(lead);
  const valor = orcamento
    ? Number(orcamento.valor_total)
    : Number(lead.valor_potencial ?? 0);

  const historicoParts = [
    `Lead desde ${formatDate(lead.created_at.slice(0, 10))}`,
    `Última atualização há ${idleDays} dia(s)`,
    lead.observacoes ? `Notas: ${lead.observacoes}` : null,
    orcamento?.local ? `Local: ${orcamento.local}` : null,
    orcamento?.data_evento
      ? `Data do evento: ${formatDate(orcamento.data_evento)}`
      : null,
  ].filter(Boolean);

  return {
    nome: lead.nome,
    tipoEvento,
    valor,
    statusLabel: getGrowthLeadStatusLabel(lead.status),
    idleDays,
    idleTier: getFollowUpIdleTier(idleDays),
    historico: historicoParts.join(" · "),
    leadId: lead.id,
    orcamentoId: orcamento?.id ?? null,
    canal: lead.canal,
    telefone: lead.contato,
  };
}

export function buildFollowUpContextFromOrcamento(
  orcamento: Orcamento,
  cliente: Cliente | null
): FollowUpContext {
  const idleDays = daysSinceContact(orcamento.updated_at);
  const status = normalizeOrcamentoStatus(orcamento.status);

  return {
    nome: cliente?.nome ?? "Cliente",
    tipoEvento: orcamento.tipo_evento,
    valor: Number(orcamento.valor_total),
    statusLabel: getOrcamentoStatusLabel(status),
    idleDays,
    idleTier: getFollowUpIdleTier(idleDays),
    historico: [
      `Orçamento desde ${formatDate(orcamento.created_at.slice(0, 10))}`,
      `Última atualização há ${idleDays} dia(s)`,
      orcamento.observacoes ? `Notas: ${orcamento.observacoes}` : null,
      orcamento.local ? `Local: ${orcamento.local}` : null,
      orcamento.data_evento
        ? `Data: ${formatDate(orcamento.data_evento)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    leadId: null,
    orcamentoId: orcamento.id,
    canal: cliente?.instagram ? "instagram" : "whatsapp",
    telefone: cliente?.telefone ?? null,
  };
}

const ORCAMENTO_FOLLOW_UP_STATUSES = new Set([
  "rascunho",
  "enviado",
  "negociacao",
]);

export function listStaleOpportunities(params: {
  leads: GrowthLead[];
  orcamentos: Orcamento[];
  clientes?: Cliente[];
}): StaleOpportunity[] {
  const { leads, orcamentos, clientes = [] } = params;
  const clientesById = new Map(clientes.map((c) => [c.id, c]));
  const linkedOrcamentoIds = new Set<string>();
  const items: StaleOpportunity[] = [];

  for (const lead of leads) {
    if (
      !GROWTH_LEAD_ACTIVE_STATUSES.includes(
        lead.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
      )
    ) {
      continue;
    }

    const idleDays = daysSinceContact(lead.updated_at);
    const tier = getFollowUpIdleTier(idleDays);
    if (!tier) continue;

    const orcamento = findOrcamentoForLead(lead, orcamentos);
    if (orcamento) linkedOrcamentoIds.add(orcamento.id);

    items.push({
      lead,
      orcamento,
      context: buildFollowUpContextFromLead(lead, orcamento),
      priority: tier * 10 + (lead.valor_potencial ?? 0) / 500,
    });
  }

  for (const orcamento of orcamentos) {
    if (linkedOrcamentoIds.has(orcamento.id)) continue;
    const status = normalizeOrcamentoStatus(orcamento.status);
    if (!ORCAMENTO_FOLLOW_UP_STATUSES.has(status)) continue;

    const idleDays = daysSinceContact(orcamento.updated_at);
    const tier = getFollowUpIdleTier(idleDays);
    if (!tier) continue;

    const cliente = orcamento.cliente_id
      ? (clientesById.get(orcamento.cliente_id) ?? null)
      : null;

    items.push({
      lead: null,
      orcamento,
      context: buildFollowUpContextFromOrcamento(orcamento, cliente),
      priority: tier * 10 + Number(orcamento.valor_total) / 500,
    });
  }

  return items.sort((a, b) => b.priority - a.priority);
}

export function getTopStaleOpportunity(
  params: Parameters<typeof listStaleOpportunities>[0]
): StaleOpportunity | null {
  return listStaleOpportunities(params)[0] ?? null;
}

export function buildDefaultFollowUpMessages(
  ctx: FollowUpContext
): Record<FollowUpChannel, string> {
  const valor = formatBRL(ctx.valor);
  const intro = `Olá ${ctx.nome.split(" ")[0]}, tudo bem?`;
  const corpo = `Passando para saber se ficou alguma dúvida sobre a proposta que enviei para o seu ${ctx.tipoEvento} (${valor}).`;

  const whatsapp = [intro, "", corpo, "", "Fico à disposição para alinhar os detalhes e garantir uma experiência premium no seu evento.", "", "Abraço,\nAnderson · Alvesz Experience"].join("\n");

  const instagram = [intro, corpo, "Posso te mandar os detalhes por aqui também? ✨"].join(" ");

  const email = [
    `Assunto: Sobre sua proposta — ${ctx.tipoEvento}`,
    "",
    `Olá ${ctx.nome},`,
    "",
    corpo,
    "",
    `Status atual: ${ctx.statusLabel}.`,
    ctx.historico ? `Contexto: ${ctx.historico}` : "",
    "",
    "Fico à disposição para uma conversa rápida e fechar os próximos passos.",
    "",
    "Atenciosamente,",
    "Anderson Alves",
    "Alvesz Experience",
  ]
    .filter(Boolean)
    .join("\n");

  return { whatsapp, instagram, email };
}

export function buildFollowUpCalendarSuggestion(ctx: FollowUpContext): {
  titulo: string;
  descricao: string;
  data: string;
  hora: string;
  tipo: "followup";
  growth_lead_id: string | null;
} {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  const data = date.toISOString().slice(0, 10);

  return {
    titulo: `Follow-up — ${ctx.nome}`,
    descricao: `Retomar ${ctx.tipoEvento} (${formatBRL(ctx.valor)}). ${ctx.historico}`,
    data,
    hora: "10:00",
    tipo: "followup",
    growth_lead_id: ctx.leadId,
  };
}

export function buildFollowUpEventoPayload(ctx: FollowUpContext) {
  const suggestion = buildFollowUpCalendarSuggestion(ctx);
  return {
    titulo: suggestion.titulo,
    descricao: suggestion.descricao,
    data_inicio: buildEventoDateTime(suggestion.data, suggestion.hora),
    local: null as string | null,
    tipo: suggestion.tipo,
    growth_lead_id: suggestion.growth_lead_id,
  };
}

export function formatAuraCentralFollowUpReply(
  opp: StaleOpportunity
): string {
  const { context: ctx } = opp;
  const tier = ctx.idleTier ? getFollowUpTierLabel(ctx.idleTier) : "";
  const lines = [
    `**Fazer follow-up com ${ctx.nome}**`,
    "",
    `${tier}. ${ctx.tipoEvento} · ${formatBRL(ctx.valor)} · ${ctx.statusLabel}.`,
    "",
    "Sugestão de abertura:",
    `> ${buildDefaultFollowUpMessages(ctx).whatsapp.split("\n").slice(0, 2).join(" ")}`,
  ];

  const others = listStaleOpportunities({
    leads: opp.lead ? [opp.lead] : [],
    orcamentos: opp.orcamento ? [opp.orcamento] : [],
  });

  if (others.length <= 1) {
    lines.push("", "Abra Crescimento Digital → Gerar follow-up para mensagens completas (WhatsApp, Instagram e e-mail).");
  }

  return lines.join("\n");
}

export function buildFollowUpMentorSection(
  leads: GrowthLead[],
  orcamentos: Orcamento[],
  clientes: Cliente[] = []
): string {
  const stale = listStaleOpportunities({ leads, orcamentos, clientes });
  if (stale.length === 0) {
    return "## FOLLOW-UP COMERCIAL\nNenhum lead parado (3+ dias sem contato).";
  }

  const lines = stale.slice(0, 8).map((item) => {
    const ctx = item.context;
    const tier = ctx.idleTier ? getFollowUpTierLabel(ctx.idleTier) : "";
    return `* ${ctx.nome} — ${tier} — ${ctx.tipoEvento} — ${formatBRL(ctx.valor)} — ${ctx.statusLabel}`;
  });

  const top = stale[0];
  return `## FOLLOW-UP COMERCIAL (prioridade máxima hoje)
Ação #1 recomendada: **Fazer follow-up com ${top.context.nome}**.

${lines.join("\n")}

Instrução: quando o usuário perguntar "o que fazer hoje", cite primeiro o follow-up com o nome real do lead mais parado.`;
}

export function isTodayPlanningQuery(message: string, actionId?: string): boolean {
  if (actionId === "o-que-fazer") return true;
  const n = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return [
    "o que devo fazer hoje",
    "o que fazer hoje",
    "o que tenho hoje",
    "prioridades de hoje",
    "meu dia",
  ].some((p) => n.includes(p));
}
