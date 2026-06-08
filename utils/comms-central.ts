import type { Cliente, GrowthLead, Orcamento } from "@/types/database";
import type { CommunicationLog } from "@/types/database";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import {
  daysSinceContact,
  listStaleOpportunities,
  type StaleOpportunity,
} from "@/utils/follow-up";
import { formatBRL, formatDate } from "@/utils/format";
import { getGrowthLeadStatusLabel } from "@/utils/growth";

export type CommsCentralQueryType =
  | "client-responses"
  | "propostas-sem-retorno"
  | "proposta-parada"
  | "clientes-sem-retorno"
  | "contatar-hoje"
  | null;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const RESPONSE_PHRASES = [
  "tenho respostas de clientes",
  "respostas de clientes",
  "algum cliente respondeu",
  "emails de clientes",
  "e-mails de clientes",
];

const NO_RETURN_PHRASES = [
  "propostas ainda nao tiveram retorno",
  "propostas sem retorno",
  "quais propostas sem retorno",
  "propostas sem resposta",
  "orcamentos sem retorno",
];

const STALLED_PROPOSAL_PHRASES = [
  "qual proposta esta parada",
  "qual proposta está parada",
  "proposta parada",
  "proposta travada",
  "qual proposta precisa de retorno",
];

const NO_RESPONSE_CLIENTS_PHRASES = [
  "quais clientes estao sem retorno",
  "quais clientes estão sem retorno",
  "clientes sem retorno",
  "clientes sem resposta",
  "quem esta sem retorno",
  "quem está sem retorno",
];

const CONTACT_TODAY_PHRASES = [
  "clientes devo contatar hoje",
  "quais clientes devo contatar",
  "quem devo contatar hoje",
  "contatar hoje",
];

export function detectCommsCentralQuery(message: string): CommsCentralQueryType {
  const n = normalize(message);
  if (RESPONSE_PHRASES.some((p) => n.includes(normalize(p)))) return "client-responses";
  if (STALLED_PROPOSAL_PHRASES.some((p) => n.includes(normalize(p)))) return "proposta-parada";
  if (NO_RESPONSE_CLIENTS_PHRASES.some((p) => n.includes(normalize(p)))) return "clientes-sem-retorno";
  if (NO_RETURN_PHRASES.some((p) => n.includes(normalize(p)))) return "propostas-sem-retorno";
  if (CONTACT_TODAY_PHRASES.some((p) => n.includes(normalize(p)))) return "contatar-hoje";
  return null;
}

function filterSentProposals(orcamentos: Orcamento[], logs: CommunicationLog[]) {
  const sentOrcamentoIds = new Set(
    logs
      .filter((l) => l.channel === "email" && l.orcamento_id)
      .map((l) => l.orcamento_id as string)
  );

  return orcamentos.filter((o) => {
    const status = normalizeOrcamentoStatus(o.status);
    return (
      sentOrcamentoIds.has(o.id) ||
      status === "enviado" ||
      status === "negociacao"
    );
  });
}

export function buildCommsCentralReply(params: {
  query: CommsCentralQueryType;
  logs: CommunicationLog[];
  leads: GrowthLead[];
  orcamentos: Orcamento[];
  clientes: Cliente[];
  gmailConnected: boolean;
  recentInboundCount: number;
}): string {
  const { query, logs, leads, orcamentos, clientes, gmailConnected, recentInboundCount } =
    params;

  const stale = listStaleOpportunities({ leads, orcamentos, clientes });
  const sentProposals = filterSentProposals(orcamentos, logs);
  const openedCount = logs.filter((l) => l.proposta_id && l.status === "opened").length;

  switch (query) {
    case "client-responses": {
      if (!gmailConnected) {
        return `**Respostas de clientes**

Conecte o Gmail em **Comunicação** para ver e-mails recentes na caixa de entrada.

No Supabase, há **${logs.filter((l) => l.direction === "inbound").length}** registro(s) de comunicação inbound.`;
      }
      const lines = [
        "**Respostas de clientes**",
        "",
        gmailConnected
          ? `Na caixa de entrada (última sincronização): **${recentInboundCount}** mensagem(ns) recente(s) de contatos.`
          : "Gmail não conectado.",
        "",
        "Abra **Dashboard → Comunicação → Gmail** para ler conversas e buscar por cliente.",
      ];
      if (stale.length > 0) {
        lines.push(
          "",
          `Há **${stale.length}** oportunidade(s) aguardando seu retorno (follow-up).`
        );
      }
      return lines.join("\n");
    }

    case "propostas-sem-retorno": {
      const semRetorno = sentProposals.filter((o) => {
        const related = logs.filter((l) => l.orcamento_id === o.id);
        const hasOpen = related.some((l) => l.status === "opened");
        const status = normalizeOrcamentoStatus(o.status);
        return !hasOpen && status !== "fechado" && status !== "perdido";
      });

      if (semRetorno.length === 0) {
        return "**Propostas sem retorno**\n\nNenhuma proposta enviada aguardando retorno no momento. 🎯";
      }

      const lines = [
        `**Propostas sem retorno** (${semRetorno.length})`,
        "",
        ...semRetorno.slice(0, 8).map((o) => {
          const cliente = clientes.find((c) => c.id === o.cliente_id);
          const nome = cliente?.nome ?? "Cliente";
          return `· **${nome}** — ${o.tipo_evento} (${formatBRL(Number(o.valor_total))}) · ${normalizeOrcamentoStatus(o.status)}`;
        }),
      ];

      if (openedCount > 0) {
        lines.push("", `${openedCount} proposta(s) com abertura registrada (pixel de rastreio).`);
      }

      lines.push("", "Gere follow-up em **Comunicação** ou Crescimento Digital.");
      return lines.join("\n");
    }

    case "proposta-parada": {
      const semRetorno = sentProposals.filter((o) => {
        const related = logs.filter((l) => l.orcamento_id === o.id);
        const hasOpen = related.some((l) => l.status === "opened");
        const status = normalizeOrcamentoStatus(o.status);
        return !hasOpen && status !== "fechado" && status !== "perdido";
      });

      if (semRetorno.length === 0) {
        return "**Proposta parada**\n\nNenhuma proposta enviada aguardando retorno no momento.";
      }

      const top = semRetorno.sort(
        (a, b) => daysSinceContact(b.updated_at) - daysSinceContact(a.updated_at)
      )[0];
      const cliente = clientes.find((c) => c.id === top.cliente_id);
      const idle = daysSinceContact(top.updated_at);

      return [
        "**Proposta mais parada**",
        "",
        `· **${cliente?.nome ?? "Cliente"}** — ${top.tipo_evento}`,
        `· Valor: ${formatBRL(Number(top.valor_total))}`,
        `· Status: ${normalizeOrcamentoStatus(top.status)}`,
        `· Sem movimento há **${idle} dia(s)**`,
        "",
        "Gere follow-up em **Comunicação** com contexto do orçamento e cliente.",
      ].join("\n");
    }

    case "clientes-sem-retorno": {
      const longIdle = stale.filter((s) => (s.context.idleTier ?? 0) >= 7);
      if (longIdle.length === 0) {
        return "**Clientes sem retorno**\n\nNenhum cliente parado há 7+ dias no momento.";
      }

      const lines = [
        `**Clientes sem retorno** (${longIdle.length})`,
        "",
        ...longIdle.slice(0, 8).map((item, i) => {
          const ctx = item.context;
          return `${i + 1}. **${ctx.nome}** — ${ctx.tipoEvento} — ${formatBRL(ctx.valor)} — ${ctx.idleDays}d sem contato`;
        }),
        "",
        "Priorize follow-up com IA em **Comunicação**.",
      ];
      return lines.join("\n");
    }

    case "contatar-hoje": {
      if (stale.length === 0) {
        return "**Contatos de hoje**\n\nNenhum lead ou orçamento parado há 3+ dias. Pipeline em dia! ✅";
      }

      const lines = [
        `**Clientes para contatar hoje** (${Math.min(stale.length, 10)})`,
        "",
      ];

      stale.slice(0, 10).forEach((item: StaleOpportunity, i) => {
        const ctx = item.context;
        lines.push(
          `${i + 1}. **${ctx.nome}** — ${ctx.tipoEvento} — ${formatBRL(ctx.valor)} — ${ctx.statusLabel}${ctx.idleTier ? ` (${ctx.idleDays} dias parado)` : ""}`
        );
      });

      lines.push(
        "",
        "Use **Comunicação → Follow-up** para gerar WhatsApp, Instagram ou e-mail com IA."
      );
      return lines.join("\n");
    }

    default:
      return "";
  }
}

export function buildCommsMentorSection(
  logs: CommunicationLog[],
  leads: GrowthLead[],
  orcamentos: Orcamento[],
  clientes: Cliente[]
): string {
  const stale = listStaleOpportunities({ leads, orcamentos, clientes });
  const emailsSent = logs.filter((l) => l.channel === "email" && l.direction === "outbound").length;
  const propostasSent = logs.filter((l) => l.proposta_id).length;

  return `## COMUNICAÇÃO (Centro Aura)
E-mails enviados (registro): ${emailsSent}
Propostas enviadas por e-mail: ${propostasSent}
Follow-ups pendentes (3+ dias): ${stale.length}
${stale[0] ? `Prioridade: contatar **${stale[0].context.nome}** hoje.` : "Nenhum follow-up urgente."}`;
}
