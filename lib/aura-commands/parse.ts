import OpenAI from "openai";
import type { AuraCommandId, AuraCommandPayload } from "@/utils/aura-commands";
import { buildPendingAuraCommand } from "@/utils/aura-commands";
import { safeJsonParse } from "@/utils/safe-json";
import { todayIsoDate } from "@/utils/health";
import { GASTO_CATEGORIAS, INCOME_ORIGENS } from "@/utils/finance";
import type { AuraCommandParseContext } from "./context";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PARSE_SPECS: Record<
  AuraCommandId,
  { fields: string; extra?: (ctx: AuraCommandParseContext) => string }
> = {
  "calendario.criar-evento": {
    fields: `{"titulo":"string","descricao":"string|null","data":"YYYY-MM-DD","hora":"HH:MM","tipo":"geral|reuniao|evento|followup|social"}`,
  },
  "calendario.remarcar-evento": {
    fields: `{"evento_id":"uuid|null","titulo_busca":"string","data":"YYYY-MM-DD","hora":"HH:MM"}`,
    extra: (ctx) =>
      `Eventos existentes:\n${ctx.eventos.map((e) => `- id:${e.id} | ${e.titulo} | ${e.data} ${e.hora}`).join("\n") || "(nenhum)"}`,
  },
  "calendario.cancelar-evento": {
    fields: `{"evento_id":"uuid|null","titulo_busca":"string"}`,
    extra: (ctx) =>
      `Eventos:\n${ctx.eventos.map((e) => `- id:${e.id} | ${e.titulo}`).join("\n") || "(nenhum)"}`,
  },
  "crescimento.criar-lead": {
    fields: `{"nome":"string","contato":"string|null","origem":"string","canal":"instagram|whatsapp|indicacao|outro","vertical":"alvesz|consorcios|marca_pessoal|null","status":"novo|contato|proposta|negociacao","valor_potencial":number,"observacoes":"string|null"}`,
  },
  "crescimento.atualizar-lead": {
    fields: `{"lead_id":"uuid|null","nome_busca":"string","status":"novo|contato|proposta|negociacao|fechado|perdido","valor_potencial":number|null,"observacoes":"string|null"}`,
    extra: (ctx) =>
      `Leads:\n${ctx.leads.map((l) => `- id:${l.id} | ${l.nome} | ${l.status}`).join("\n") || "(nenhum)"}`,
  },
  "crescimento.fechar-lead": {
    fields: `{"lead_id":"uuid|null","nome_busca":"string"}`,
    extra: (ctx) =>
      `Leads:\n${ctx.leads.map((l) => `- id:${l.id} | ${l.nome}`).join("\n") || "(nenhum)"}`,
  },
  "alvesz.criar-orcamento": {
    fields: `{"cliente_id":"uuid|null","cliente_nome":"string|null","tipo_evento":"string","convidados":number,"valor_total":number,"data_evento":"YYYY-MM-DD|null","local":"string|null","status":"rascunho|enviado|negociacao"}`,
    extra: (ctx) =>
      `Clientes:\n${ctx.clientes.map((c) => `- id:${c.id} | ${c.nome}`).join("\n") || "(nenhum)"}`,
  },
  "alvesz.criar-cliente": {
    fields: `{"nome":"string","telefone":"string|null","instagram":"string|null","observacoes":"string|null"}`,
  },
  "alvesz.criar-evento": {
    fields: `{"titulo":"string","data_evento":"YYYY-MM-DD","local":"string|null","cliente_id":"uuid|null","cliente_nome":"string|null","valor_fechado":number}`,
    extra: (ctx) =>
      `Clientes:\n${ctx.clientes.map((c) => `- id:${c.id} | ${c.nome}`).join("\n") || "(nenhum)"}`,
  },
  "saude.criar-treino": {
    fields: `{"nome":"string","grupo_muscular":"string","duracao_min":number,"exercicios":[{"nome":"string","series":"string","reps":"string","observacao":"string"}],"observacoes":"string|null"}`,
  },
  "saude.criar-habito": {
    fields: `{"titulo":"string","frequencia":"diario|semanal","status":"pendente|concluido"}`,
  },
  "saude.criar-refeicao": {
    fields: `{"nome":"string","horario":"HH:MM","alimentos":"string|null","calorias":number|null}`,
  },
  "financeiro.registrar-receita": {
    fields: `{"descricao":"string","valor":number,"origem":"alvesz|consorcios|salario|freelance|outros","data":"YYYY-MM-DD"}`,
  },
  "financeiro.registrar-despesa": {
    fields: `{"titulo":"string","valor":number,"categoria":"alimentacao|transporte|saude|lazer|equipamentos|empresa|outros","data":"YYYY-MM-DD"}`,
  },
  "financeiro.definir-saldo": {
    fields: `{"valor_atual":number}`,
  },
};

function normalizeExpenseCategory(raw: string): string {
  const n = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, string> = {
    gasolina: "transporte",
    combustivel: "transporte",
    uber: "transporte",
    transporte: "transporte",
    mercado: "alimentacao",
    alimentacao: "alimentacao",
    farmacia: "saude",
    saude: "saude",
    academia: "saude",
    lazer: "lazer",
    empresa: "empresa",
  };
  for (const [key, cat] of Object.entries(map)) {
    if (n.includes(key)) return cat;
  }
  const valid = GASTO_CATEGORIAS.map((c) => c.value);
  return valid.includes(raw as (typeof valid)[number]) ? raw : "outros";
}

function postProcessPayload(
  commandId: AuraCommandId,
  parsed: AuraCommandPayload
): AuraCommandPayload {
  const hoje = todayIsoDate();

  switch (commandId) {
    case "financeiro.registrar-despesa": {
      const titulo = String(parsed.titulo ?? "").trim() || "Despesa";
      const categoria = normalizeExpenseCategory(String(parsed.categoria ?? titulo));
      return {
        titulo,
        valor: Math.max(0.01, Number(parsed.valor) || 0),
        categoria,
        data: String(parsed.data ?? hoje).slice(0, 10),
      };
    }
    case "financeiro.registrar-receita":
      return {
        descricao: String(parsed.descricao ?? "Receita").trim(),
        valor: Math.max(0.01, Number(parsed.valor) || 0),
        origem: INCOME_ORIGENS.some((o) => o.value === parsed.origem)
          ? parsed.origem
          : "outros",
        data: String(parsed.data ?? hoje).slice(0, 10),
      };
    case "financeiro.definir-saldo":
      return { valor_atual: Math.max(0, Number(parsed.valor_atual) || 0) };
    case "calendario.criar-evento":
      return {
        titulo: String(parsed.titulo ?? "Compromisso").trim(),
        descricao: parsed.descricao ? String(parsed.descricao).trim() : null,
        data: String(parsed.data ?? hoje).slice(0, 10),
        hora: parsed.hora ? String(parsed.hora).slice(0, 5) : "09:00",
        tipo: parsed.tipo ?? "reuniao",
      };
    case "crescimento.fechar-lead":
      return {
        ...parsed,
        status: "fechado",
      };
    case "alvesz.criar-orcamento": {
      const valor = Number(parsed.valor_total) || 0;
      return {
        ...parsed,
        convidados: Number(parsed.convidados) || 50,
        valor_total: valor,
        lucro_estimado: Math.round(valor * 0.38 * 100) / 100,
        status: parsed.status ?? "rascunho",
      };
    }
    default:
      return parsed;
  }
}

function validatePayload(
  commandId: AuraCommandId,
  payload: AuraCommandPayload
): string | null {
  switch (commandId) {
    case "financeiro.registrar-despesa":
    case "financeiro.registrar-receita":
      if (!Number(payload.valor) || Number(payload.valor) <= 0) {
        return "Informe um valor válido.";
      }
      return null;
    case "financeiro.definir-saldo":
      if (payload.valor_atual == null || Number.isNaN(Number(payload.valor_atual))) {
        return "Informe o saldo.";
      }
      return null;
    case "calendario.criar-evento":
      if (!payload.titulo || !payload.data) return "Não entendi o compromisso.";
      return null;
    case "calendario.remarcar-evento":
    case "calendario.cancelar-evento":
      if (!payload.evento_id && !payload.titulo_busca) {
        return "Qual evento devo alterar? Informe o título.";
      }
      return null;
    case "crescimento.criar-lead":
      if (!payload.nome) return "Informe o nome do lead.";
      return null;
    case "crescimento.atualizar-lead":
    case "crescimento.fechar-lead":
      if (!payload.lead_id && !payload.nome_busca) {
        return "Qual lead? Informe o nome.";
      }
      return null;
    case "alvesz.criar-cliente":
      if (!payload.nome) return "Informe o nome do cliente.";
      return null;
    case "alvesz.criar-orcamento":
      if (!payload.tipo_evento) return "Informe o tipo de evento do orçamento.";
      return null;
    case "alvesz.criar-evento":
      if (!payload.titulo || !payload.data_evento) return "Informe título e data do evento.";
      return null;
    case "saude.criar-treino":
      if (!payload.nome) return "Não foi possível montar o treino.";
      return null;
    case "saude.criar-habito":
      if (!payload.titulo) return "Informe o hábito.";
      return null;
    case "saude.criar-refeicao":
      if (!payload.nome) return "Informe a refeição.";
      return null;
    default:
      return null;
  }
}

export async function parseAuraCommand(
  commandId: AuraCommandId,
  message: string,
  parseContext: AuraCommandParseContext
): Promise<{ pending: ReturnType<typeof buildPendingAuraCommand> | null; error: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    return { pending: null, error: "OPENAI_API_KEY não configurada." };
  }

  const spec = PARSE_SPECS[commandId];
  const hoje = todayIsoDate();
  const categorias = GASTO_CATEGORIAS.map((c) => c.value).join(", ");
  const extra = spec.extra?.(parseContext) ?? "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você extrai dados de comandos em português do Brasil para a Aura OS.
Comando: ${commandId}
Data de hoje: ${hoje}
Responda APENAS JSON com os campos: ${spec.fields}
${commandId === "financeiro.registrar-despesa" ? `Categorias válidas: ${categorias}. Inferir categoria pelo contexto (ex.: gasolina → transporte).` : ""}
${extra}`,
      },
      { role: "user", content: message },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = postProcessPayload(
    commandId,
    safeJsonParse<AuraCommandPayload>(raw, {})
  );

  const validationError = validatePayload(commandId, parsed);
  if (validationError) {
    return { pending: null, error: validationError };
  }

  return { pending: buildPendingAuraCommand(commandId, parsed), error: null };
}
