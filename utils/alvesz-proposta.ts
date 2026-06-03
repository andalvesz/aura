import type { Cliente, Orcamento } from "@/types/database";
import { getOrcamentoStatusLabel } from "@/utils/alvesz-integration";
import { formatBRL, formatDate } from "@/utils/format";

/** Metadados reservados para exportação PDF (futuro). */
export type AlveszPropostaPdfMeta = {
  ready: boolean;
  version: number;
  templateId?: string;
  exportedAt?: string;
};

export const DEFAULT_ALVESZ_PROPOSTA_PDF_META: AlveszPropostaPdfMeta = {
  ready: false,
  version: 1,
};

export type AlveszPropostaInput = {
  orcamento: Orcamento;
  cliente: Cliente | null;
};

export function suggestPacoteAlvesz(convidados: number, tipoEvento: string): string {
  const tipo = tipoEvento.toLowerCase();
  if (convidados >= 150 || tipo.includes("premium") || tipo.includes("corporat")) {
    return "Pacote Premium Experience — bartenders seniores, bar premium completo, drinks autorais, mise en place exclusiva e coordenação de barra no evento.";
  }
  if (convidados >= 50) {
    return "Pacote Signature — equipe de bartenders, bar completo, drinks clássicos e autorais, gelo e insumos premium, montagem e operação durante o evento.";
  }
  return "Pacote Essencial — bartender dedicado, bar mobile, drinks selecionados, insumos de qualidade e montagem para recepção íntima ou celebração compacta.";
}

export function buildAlveszProposta({ orcamento, cliente }: AlveszPropostaInput): string {
  const clienteNome = cliente?.nome ?? "Cliente";
  const dataLabel = orcamento.data_evento
    ? formatDate(orcamento.data_evento)
    : "A definir";
  const local = orcamento.local?.trim() || "A definir";
  const convidados = Number(orcamento.convidados);
  const valor = formatBRL(Number(orcamento.valor_total));
  const status = getOrcamentoStatusLabel(orcamento.status);
  const observacoes =
    orcamento.observacoes?.trim() ||
    cliente?.observacoes?.trim() ||
    "Sem observações adicionais.";
  const pacote = suggestPacoteAlvesz(convidados, orcamento.tipo_evento);

  return [
    "✨ ALVESZ EXPERIENCE",
    "Proposta comercial personalizada",
    "",
    "— APRESENTAÇÃO —",
    "A Alvesz Experience transforma eventos em experiências memoráveis com bartender profissional, drinks autorais e operação impecável de barra. Nossa assinatura é elegância, precisão e um serviço que eleva o nível da sua celebração.",
    "",
    "— DETALHES DO EVENTO —",
    `Cliente: ${clienteNome}`,
    `Tipo: ${orcamento.tipo_evento}`,
    `Data: ${dataLabel}`,
    `Local: ${local}`,
    `Convidados: ${convidados}`,
    `Status do orçamento: ${status}`,
    `Observações: ${observacoes}`,
    "",
    "— PACOTE SUGERIDO —",
    pacote,
    "",
    "— INVESTIMENTO —",
    `Valor total do pacote: ${valor}`,
    "",
    "— CONDIÇÕES —",
    "• Reserva mediante sinal de 30% para garantir data e equipe.",
    "• Saldo até 5 dias úteis antes do evento.",
    "• Cardápio e quantidade de drinks alinhados na reunião de briefing.",
    "• Deslocamento e estrutura extra sob consulta conforme local.",
    "• Validade desta proposta: 7 dias corridos.",
    "",
    "— PRÓXIMOS PASSOS —",
    "1. Confirmar data, local e número final de convidados.",
    "2. Aprovar cardápio e pacote sugerido.",
    "3. Formalizar reserva com sinal.",
    "4. Reunião de alinhamento operacional (briefing).",
    "",
    "Estamos prontos para entregar uma experiência premium no seu evento.",
    "Alvesz Experience — Bartender & Eventos",
  ].join("\n");
}

/** Formato otimizado para colar no WhatsApp (sem quebras excessivas). */
export function formatPropostaWhatsApp(texto: string): string {
  return texto
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
