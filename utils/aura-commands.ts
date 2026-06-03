import { getCategoryLabel } from "@/utils/finance";
import { formatBRL } from "@/utils/format";
import { getGrowthLeadStatusLabel } from "@/utils/growth";
import type { GrowthLeadStatus } from "@/types/database";

export type AuraCommandModule =
  | "calendario"
  | "crescimento"
  | "alvesz"
  | "saude"
  | "financeiro";

export type AuraCommandId =
  | "calendario.criar-evento"
  | "calendario.remarcar-evento"
  | "calendario.cancelar-evento"
  | "crescimento.criar-lead"
  | "crescimento.atualizar-lead"
  | "crescimento.fechar-lead"
  | "alvesz.criar-orcamento"
  | "alvesz.criar-cliente"
  | "alvesz.criar-evento"
  | "saude.criar-treino"
  | "saude.criar-habito"
  | "saude.criar-refeicao"
  | "financeiro.registrar-receita"
  | "financeiro.registrar-despesa"
  | "financeiro.definir-saldo";

export type AuraCommandPayload = Record<string, unknown>;

export type PendingAuraCommand = {
  id: string;
  commandId: AuraCommandId;
  module: AuraCommandModule;
  payload: AuraCommandPayload;
  confirmText: string;
  summary: string;
};

export type AuraCommandHistoryEntry = {
  id: string;
  command_id: string;
  module: string;
  summary: string;
  payload: AuraCommandPayload;
  result: AuraCommandPayload | null;
  status: "success" | "error";
  error_message: string | null;
  created_at: string;
};

export const AURA_COMMAND_MODULE_LABELS: Record<AuraCommandModule, string> = {
  calendario: "Calendário",
  crescimento: "Crescimento",
  alvesz: "Alvesz",
  saude: "Saúde",
  financeiro: "Financeiro",
};

export const AURA_COMMAND_LABELS: Record<AuraCommandId, string> = {
  "calendario.criar-evento": "Criar evento",
  "calendario.remarcar-evento": "Remarcar evento",
  "calendario.cancelar-evento": "Cancelar evento",
  "crescimento.criar-lead": "Criar lead",
  "crescimento.atualizar-lead": "Atualizar lead",
  "crescimento.fechar-lead": "Fechar lead",
  "alvesz.criar-orcamento": "Criar orçamento",
  "alvesz.criar-cliente": "Criar cliente",
  "alvesz.criar-evento": "Criar evento Alvesz",
  "saude.criar-treino": "Criar treino",
  "saude.criar-habito": "Criar hábito",
  "saude.criar-refeicao": "Criar refeição",
  "financeiro.registrar-receita": "Registrar receita",
  "financeiro.registrar-despesa": "Registrar despesa",
  "financeiro.definir-saldo": "Definir saldo",
};

const COMMAND_CONFIRMATION_PHRASES = new Set([
  "confirmado",
  "confirmar",
  "sim",
  "ok",
  "salvar",
  "pode salvar",
  "executar",
  "confirmo",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export function isAuraCommandConfirmation(message: string): boolean {
  const n = normalize(message).replace(/[!?.。,;:]+$/g, "");
  return COMMAND_CONFIRMATION_PHRASES.has(n);
}

function commandModule(commandId: AuraCommandId): AuraCommandModule {
  return commandId.split(".")[0] as AuraCommandModule;
}

type CommandPattern = {
  id: AuraCommandId;
  phrases: readonly string[];
  exclude?: readonly string[];
};

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    id: "financeiro.registrar-despesa",
    phrases: [
      "registrar despesa",
      "adicionar despesa",
      "adicionar gasto",
      "registrar gasto",
      "nova despesa",
      "gastei ",
      "paguei ",
    ],
  },
  {
    id: "financeiro.registrar-receita",
    phrases: [
      "registrar receita",
      "adicionar receita",
      "nova receita",
      "entrada de ",
      "recebi ",
    ],
    exclude: ["analise", "analisar", "vendas", "meta"],
  },
  {
    id: "financeiro.definir-saldo",
    phrases: [
      "definir saldo",
      "atualizar saldo",
      "meu saldo e",
      "meu saldo é",
      "saldo inicial",
      "saldo atual e",
      "saldo atual é",
    ],
  },
  {
    id: "calendario.cancelar-evento",
    phrases: [
      "cancelar evento",
      "cancelar reuniao",
      "cancelar compromisso",
      "remover da agenda",
      "excluir evento",
    ],
  },
  {
    id: "calendario.remarcar-evento",
    phrases: [
      "remarcar",
      "reagendar",
      "mudar data",
      "alterar horario",
      "alterar horário",
      "adiar reuniao",
      "adiar evento",
    ],
  },
  {
    id: "calendario.criar-evento",
    phrases: [
      "marque ",
      "marca ",
      "agende ",
      "agendar ",
      "criar evento",
      "criar compromisso",
      "criar reuniao",
      "marcar reuniao",
      "marcar evento",
      "novo evento",
      "bota na agenda",
      "coloca na agenda",
    ],
    exclude: ["minha agenda", "agenda de hoje", "agenda hoje", "alvesz"],
  },
  {
    id: "crescimento.fechar-lead",
    phrases: ["fechar lead", "lead fechado", "fechou o lead", "marcar lead como fechado"],
  },
  {
    id: "crescimento.atualizar-lead",
    phrases: [
      "atualizar lead",
      "mudar status do lead",
      "mover lead",
      "lead para ",
    ],
    exclude: ["fechar lead"],
  },
  {
    id: "crescimento.criar-lead",
    phrases: ["criar lead", "novo lead", "adicionar lead", "cadastrar lead"],
  },
  {
    id: "alvesz.criar-orcamento",
    phrases: ["criar orcamento", "novo orcamento", "criar orçamento", "novo orçamento"],
  },
  {
    id: "alvesz.criar-cliente",
    phrases: ["criar cliente", "novo cliente", "cadastrar cliente"],
  },
  {
    id: "alvesz.criar-evento",
    phrases: [
      "evento alvesz",
      "evento da alvesz",
      "criar evento alvesz",
      "novo evento alvesz",
    ],
  },
  {
    id: "saude.criar-treino",
    phrases: [
      "criar treino",
      "crie treino",
      "crie meu treino",
      "monte treino",
      "monte meu treino",
      "gerar treino",
      "treino de hoje",
      "salvar treino",
    ],
  },
  {
    id: "saude.criar-habito",
    phrases: ["criar habito", "criar hábito", "novo habito", "novo hábito", "adicionar habito"],
  },
  {
    id: "saude.criar-refeicao",
    phrases: [
      "criar refeicao",
      "criar refeição",
      "adicionar refeicao",
      "registrar refeicao",
      "nova refeicao",
    ],
  },
];

export function detectAuraCommand(message: string): AuraCommandId | null {
  const normalized = normalize(message);
  if (!normalized) return null;

  for (const pattern of COMMAND_PATTERNS) {
    if (pattern.exclude?.some((ex) => normalized.includes(normalize(ex)))) {
      continue;
    }
    if (matchesAny(normalized, pattern.phrases)) {
      return pattern.id;
    }
  }

  return null;
}

export function buildPendingAuraCommand(
  commandId: AuraCommandId,
  payload: AuraCommandPayload
): PendingAuraCommand {
  const confirmText = buildCommandConfirmationText(commandId, payload);
  const summary = buildCommandSummary(commandId, payload);
  return {
    id: crypto.randomUUID(),
    commandId,
    module: commandModule(commandId),
    payload,
    confirmText,
    summary,
  };
}

export function buildCommandConfirmationText(
  commandId: AuraCommandId,
  payload: AuraCommandPayload
): string {
  switch (commandId) {
    case "financeiro.registrar-despesa": {
      const valor = Number(payload.valor);
      const categoria = String(payload.categoria ?? "outros");
      const titulo = String(payload.titulo ?? "").trim();
      const catLabel = getCategoryLabel(categoria);
      const detail = titulo ? ` (${titulo})` : "";
      return `Confirmar despesa de ${formatBRL(valor)} na categoria ${catLabel}?${detail}`;
    }
    case "financeiro.registrar-receita": {
      const valor = Number(payload.valor);
      const descricao = String(payload.descricao ?? "Receita").trim();
      return `Confirmar receita de ${formatBRL(valor)} — ${descricao}?`;
    }
    case "financeiro.definir-saldo": {
      const valor = Number(payload.valor_atual);
      return `Confirmar saldo atual de ${formatBRL(valor)}?`;
    }
    case "calendario.criar-evento": {
      const titulo = String(payload.titulo ?? "Evento");
      const data = String(payload.data ?? "");
      const hora = String(payload.hora ?? "09:00");
      return `Confirmar evento **${titulo}** em ${data} às ${hora}?`;
    }
    case "calendario.remarcar-evento": {
      const titulo = String(payload.titulo_busca ?? payload.titulo ?? "evento");
      const data = String(payload.data ?? "");
      const hora = String(payload.hora ?? "");
      return `Confirmar remarcação de **${titulo}** para ${data}${hora ? ` às ${hora}` : ""}?`;
    }
    case "calendario.cancelar-evento": {
      const titulo = String(payload.titulo_busca ?? payload.titulo ?? "evento");
      return `Confirmar cancelamento do evento **${titulo}**?`;
    }
    case "crescimento.criar-lead": {
      const nome = String(payload.nome ?? "Lead");
      return `Confirmar criação do lead **${nome}**?`;
    }
    case "crescimento.atualizar-lead": {
      const nome = String(payload.nome_busca ?? payload.nome ?? "lead");
      const status = String(payload.status ?? "");
      return `Confirmar atualização do lead **${nome}** para ${getGrowthLeadStatusLabel(status as GrowthLeadStatus)}?`;
    }
    case "crescimento.fechar-lead": {
      const nome = String(payload.nome_busca ?? payload.nome ?? "lead");
      return `Confirmar fechamento do lead **${nome}**?`;
    }
    case "alvesz.criar-orcamento": {
      const tipo = String(payload.tipo_evento ?? "evento");
      const valor = Number(payload.valor_total ?? 0);
      return `Confirmar orçamento Alvesz (${tipo}) de ${formatBRL(valor)}?`;
    }
    case "alvesz.criar-cliente": {
      const nome = String(payload.nome ?? "Cliente");
      return `Confirmar cliente **${nome}** na Alvesz?`;
    }
    case "alvesz.criar-evento": {
      const titulo = String(payload.titulo ?? "Evento");
      const data = String(payload.data_evento ?? "");
      return `Confirmar evento Alvesz **${titulo}** em ${data}?`;
    }
    case "saude.criar-treino": {
      const nome = String(payload.nome ?? "Treino");
      return `Confirmar treino **${nome}** para hoje?`;
    }
    case "saude.criar-habito": {
      const titulo = String(payload.titulo ?? "Hábito");
      return `Confirmar hábito **${titulo}**?`;
    }
    case "saude.criar-refeicao": {
      const nome = String(payload.nome ?? "Refeição");
      return `Confirmar refeição **${nome}**?`;
    }
    default:
      return "Confirmar esta ação?";
  }
}

function buildCommandSummary(commandId: AuraCommandId, payload: AuraCommandPayload): string {
  const label = AURA_COMMAND_LABELS[commandId];
  const key = Object.values(payload).find((v) => typeof v === "string" && v.trim());
  return key ? `${label}: ${String(key).slice(0, 80)}` : label;
}

export function formatCommandSuccessMessage(
  commandId: AuraCommandId,
  result: AuraCommandPayload
): string {
  const label = AURA_COMMAND_LABELS[commandId];
  const detail = result.message ? String(result.message) : "Ação concluída.";
  return `✅ ${label} — ${detail}`;
}
