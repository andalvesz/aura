import type { Cliente, GrowthLead, Orcamento } from "@/types/database";
import { buildAlveszProposta, formatPropostaWhatsApp } from "@/utils/alvesz-proposta";
import { formatBRL } from "@/utils/format";
import { getGrowthLeadStatusLabel } from "@/utils/growth";
import {
  buildDefaultFollowUpMessages,
  daysSinceContact,
  type FollowUpContext,
} from "@/utils/follow-up";

export type WhatsAppIntent = "lead" | "proposta" | "followup";

export type WhatsAppLeadContext = {
  intent: "lead";
  nome: string;
  interesse: string;
  statusLabel: string;
  valor: number;
  ultimoContatoDias: number;
  historico?: string;
};

export type WhatsAppPropostaContext = {
  intent: "proposta";
  nomeCliente: string;
  evento: string;
  valor: number;
  proximosPassos: string;
  pdfUrl?: string | null;
};

export type WhatsAppFollowUpContext = {
  intent: "followup";
  nome: string;
  tipoEvento: string;
  valor: number;
  statusLabel: string;
  idleDays: number;
  historico?: string;
};

export type WhatsAppIaContext =
  | WhatsAppLeadContext
  | WhatsAppPropostaContext
  | WhatsAppFollowUpContext;

function extractInteresseFromLead(lead: GrowthLead): string {
  const obs = lead.observacoes?.trim();
  if (obs) return obs;
  if (lead.origem?.trim()) return lead.origem;
  if (lead.vertical) return lead.vertical.replace(/_/g, " ");
  return "oportunidade comercial";
}

export function buildWhatsAppLeadContext(
  lead: GrowthLead,
  orcamento?: Orcamento | null
): WhatsAppLeadContext {
  const interesse =
    orcamento?.tipo_evento ?? extractInteresseFromLead(lead);
  const valor = orcamento
    ? Number(orcamento.valor_total)
    : Number(lead.valor_potencial ?? 0);

  return {
    intent: "lead",
    nome: lead.nome,
    interesse,
    statusLabel: getGrowthLeadStatusLabel(lead.status),
    valor,
    ultimoContatoDias: daysSinceContact(lead.updated_at),
    historico: lead.observacoes ?? undefined,
  };
}

export function buildWhatsAppPropostaContext(
  orcamento: Orcamento,
  cliente: Cliente | null,
  pdfUrl?: string | null
): WhatsAppPropostaContext {
  return {
    intent: "proposta",
    nomeCliente: cliente?.nome ?? "Cliente",
    evento: orcamento.tipo_evento,
    valor: Number(orcamento.valor_total),
    proximosPassos:
      "Confirmar data e local, aprovar pacote, formalizar reserva com sinal e alinhar briefing operacional.",
    pdfUrl: pdfUrl ?? null,
  };
}

export function buildWhatsAppFollowUpContext(
  ctx: FollowUpContext
): WhatsAppFollowUpContext {
  return {
    intent: "followup",
    nome: ctx.nome,
    tipoEvento: ctx.tipoEvento,
    valor: ctx.valor,
    statusLabel: ctx.statusLabel,
    idleDays: ctx.idleDays,
    historico: ctx.historico,
  };
}

export function buildDefaultWhatsAppMessage(ctx: WhatsAppIaContext): string {
  if (ctx.intent === "lead") {
    const primeiroNome = ctx.nome.split(" ")[0];
    const valor = ctx.valor > 0 ? formatBRL(ctx.valor) : "a combinar";
    return [
      `Olá ${primeiroNome}, tudo bem?`,
      "",
      `Passando para retomar nosso contato sobre ${ctx.interesse}.`,
      `Status atual: ${ctx.statusLabel}. Valor em discussão: ${valor}.`,
      ctx.ultimoContatoDias > 0
        ? `Faz ${ctx.ultimoContatoDias} dia(s) desde nossa última conversa.`
        : "",
      "",
      "Fico à disposição para alinhar os próximos passos com calma.",
      "",
      "Abraço,",
      "Anderson · Aura OS",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (ctx.intent === "proposta") {
    const valor = formatBRL(ctx.valor);
    const lines = [
      `Olá ${ctx.nomeCliente.split(" ")[0]}, tudo bem?`,
      "",
      `Segue o resumo da proposta Alvesz Experience para o seu ${ctx.evento}.`,
      `Investimento: ${valor}.`,
      "",
      "Próximos passos:",
      ctx.proximosPassos,
      "",
      "Fico à disposição para tirar dúvidas e ajustar os detalhes.",
      "",
      "Anderson · Alvesz Experience",
    ];
    if (ctx.pdfUrl?.trim()) {
      lines.push("", `📄 Proposta em PDF: ${ctx.pdfUrl.trim()}`);
    }
    return lines.join("\n");
  }

  const followUpCtx: FollowUpContext = {
    nome: ctx.nome,
    tipoEvento: ctx.tipoEvento,
    valor: ctx.valor,
    statusLabel: ctx.statusLabel,
    idleDays: ctx.idleDays,
    idleTier: null,
    historico: ctx.historico ?? "",
    leadId: null,
    orcamentoId: null,
    clienteId: null,
    canal: "whatsapp",
    telefone: null,
    clienteEmail: null,
  };

  return buildDefaultFollowUpMessages(followUpCtx).whatsapp;
}

export function buildPropostaWhatsAppFromOrcamento(
  orcamento: Orcamento,
  cliente: Cliente | null,
  conteudo?: string,
  pdfUrl?: string | null
): string {
  const texto =
    conteudo?.trim() ||
    buildAlveszProposta({ orcamento, cliente });
  return formatPropostaWhatsApp(texto, pdfUrl);
}
