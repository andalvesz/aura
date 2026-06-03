import OpenAI, { APIError } from "openai";
import {
  getAuraCentralFinanceContext,
  getAuraCentralOpeningSummary,
} from "@/lib/supabase/services/central.service";
import {
  getGrowthLeadsMentorContext,
  getGrowthStrategicMemoryMentorContext,
} from "@/lib/supabase/services/growth.service";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import { getAuraGlobalSummaryMentorContext } from "@/lib/supabase/services/mentor.service";
import {
  getNexusAlveszMentorContext,
  getNexusCalendarMentorContext,
} from "@/lib/supabase/services/nexus.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { GROWTH_MENTOR_EMPTY_LEADS_MESSAGE } from "@/utils/growth";
import { todayIsoDate } from "@/utils/health";
import {
  AURA_CENTRAL_CONTEXT,
  detectAuraCentralIntent,
  type AuraCentralModule,
} from "@/utils/orchestrator";
import type { ParsedEventoSuggestion } from "@/utils/calendar";
import { SOCIAL_AI_CONTEXT } from "@/utils/social";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MODULE_INSTRUCTIONS: Record<AuraCentralModule, string> = {
  global:
    "Integre todos os módulos em uma resposta consolidada. Priorize as 3 ações de maior impacto para hoje.",
  calendario:
    "Foque em agenda, compromissos e follow-ups. Use horários e títulos reais.",
  crescimento:
    "Foque em meta mensal, missões, leads, vendas e CRM. Cite nomes, status e valores reais.",
  alvesz:
    "Foque em Alvesz Experience: orçamentos, clientes, eventos e pipeline comercial.",
  saude:
    "Foque em treinos, hábitos e rotina. Respeite lesão no ombro direito. Não substitua profissionais de saúde.",
  "social-media":
    "Foque em conteúdo para @and.alvesz, Alvesz Experience e Consórcios. Ganchos fortes e CTAs.",
  financeiro:
    "Foque em gastos, saldo e orçamento pessoal. Sugira ações práticas de controle financeiro.",
};

function logCentralError(error: unknown) {
  if (error instanceof APIError) {
    console.error("[aura-central] OpenAI API error:", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return;
  }
  console.error("[aura-central] Unexpected error:", error);
}

function resolveCentralError(error: unknown): { message: string; status: number } {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return { message: "Sua API da OpenAI está sem créditos.", status: 429 };
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return { message: "Chave da OpenAI inválida.", status: 401 };
    }
  }
  return { message: "Erro ao gerar resposta da Aura Central.", status: 500 };
}

async function loadContextForModule(
  module: AuraCentralModule,
  actionId?: string
): Promise<{ context: string | null; error: string | null; leadCount?: number }> {
  switch (module) {
    case "global": {
      const { context, error } = await getAuraGlobalSummaryMentorContext();
      return { context, error };
    }
    case "calendario": {
      const { context, error } = await getNexusCalendarMentorContext();
      return { context, error };
    }
    case "crescimento": {
      const { context, error, leadCount } = await getGrowthLeadsMentorContext(
        actionId || undefined
      );
      return { context, error, leadCount };
    }
    case "alvesz": {
      const { context, error } = await getNexusAlveszMentorContext();
      return { context, error };
    }
    case "saude": {
      const { context, error } = await getHealthCoachMentorContext();
      return { context, error };
    }
    case "social-media": {
      const { context, error } = await getSocialIaMentorContext();
      return { context: context ? `${SOCIAL_AI_CONTEXT}\n\n${context}` : null, error };
    }
    case "financeiro": {
      const { context, error } = await getAuraCentralFinanceContext();
      return { context, error };
    }
    default:
      return { context: null, error: null };
  }
}

async function parseCalendarEvent(message: string): Promise<{
  suggestion: ParsedEventoSuggestion | null;
  error: string | null;
}> {
  const hoje = new Date().toISOString().slice(0, 10);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você interpreta pedidos de agenda em português do Brasil.
Responda APENAS JSON:
{"titulo":"string","descricao":"string|null","data":"YYYY-MM-DD","hora":"HH:MM","tipo":"geral|reuniao|evento|followup|social"}
Data de hoje: ${hoje}. Hora padrão 09:00 se não informada.`,
      },
      { role: "user", content: message },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const parsed = safeJsonParse<Partial<ParsedEventoSuggestion>>(raw, {});

  if (!parsed.titulo || !parsed.data) {
    return {
      suggestion: null,
      error: "Não entendi o compromisso. Tente reformular ou cadastre manualmente.",
    };
  }

  return {
    suggestion: {
      titulo: String(parsed.titulo).trim(),
      descricao: parsed.descricao ? String(parsed.descricao).trim() : null,
      data: String(parsed.data).slice(0, 10),
      hora: parsed.hora ? String(parsed.hora).slice(0, 5) : "09:00",
      tipo: parsed.tipo ?? "reuniao",
    },
    error: null,
  };
}

async function generateTreinoSuggestion(
  systemPrompt: string,
  message: string
): Promise<{ suggestion: Record<string, unknown> | null; error: string | null }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${systemPrompt}
Responda APENAS JSON:
{"nome":"string","grupo_muscular":"string","duracao_min":number,"exercicios":[{"nome":"string","series":"string","reps":"string","observacao":"string"}],"observacoes":"string|null"}
Evite exercícios que sobrecarreguem o ombro direito lesionado. Considere ginástica e dança.`,
      },
      { role: "user", content: message },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse<Record<string, unknown>>(raw, {});

  if (!parsed.nome) {
    return {
      suggestion: null,
      error: "Não foi possível montar o treino. Tente reformular.",
    };
  }

  return { suggestion: parsed, error: null };
}

export async function GET() {
  try {
    const { summary, error } = await getAuraCentralOpeningSummary();

    if (error || !summary) {
      return Response.json(
        {
          error:
            error === "Usuário não autenticado."
              ? "Faça login para ver seu resumo."
              : "Não foi possível carregar o resumo global.",
        },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json(summary);
  } catch (error) {
    console.error("[aura-central] GET error:", error);
    return Response.json({ error: "Erro ao carregar resumo." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      actionId?: string;
      history?: unknown;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : undefined;
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history.filter(
          (m: unknown): m is ChatMessage =>
            typeof m === "object" &&
            m !== null &&
            "role" in m &&
            "content" in m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
      : [];

    if (!message) {
      return Response.json({ error: "Mensagem não enviada." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const intent = detectAuraCentralIntent(message, actionId);
    const { module, mode } = intent;

    if (module === "calendario" && mode === "criar-evento") {
      const { suggestion, error: parseError } = await parseCalendarEvent(message);

      if (parseError || !suggestion) {
        return Response.json({ error: parseError ?? "Erro ao interpretar evento." }, { status: 422 });
      }

      const text = `Entendi! Sugiro este evento:\n\n📅 **${suggestion.titulo}**\n${suggestion.data} às ${suggestion.hora}${suggestion.descricao ? `\n${suggestion.descricao}` : ""}\n\nConfirme para salvar no Calendário ou acesse Aura Agenda para ajustar.`;

      return Response.json({
        text,
        module,
        kind: "evento",
        suggestion,
      });
    }

    const { context, error: contextError, leadCount } = await loadContextForModule(
      module,
      actionId
    );

    if (contextError && contextError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar a Aura Central." }, { status: 401 });
    }

    if (
      module === "crescimento" &&
      leadCount === 0 &&
      (actionId === "analisar-vendas" || message.toLowerCase().includes("vendas"))
    ) {
      return Response.json({
        text: GROWTH_MENTOR_EMPTY_LEADS_MESSAGE,
        module,
        kind: "chat",
      });
    }

    let dataContext = context;
    if (!dataContext && module === "crescimento") {
      const memory = await getGrowthStrategicMemoryMentorContext();
      dataContext = memory.context;
    }

    const systemPrompt = `${AURA_CENTRAL_CONTEXT}

## MÓDULO ATIVO: ${module.toUpperCase()}
${MODULE_INSTRUCTIONS[module]}

${dataContext ?? "## DADOS\nNenhum dado cadastrado ainda para este módulo."}`;

    if (module === "saude" && mode === "treino") {
      const { suggestion, error: treinoError } = await generateTreinoSuggestion(
        systemPrompt,
        message
      );

      if (treinoError || !suggestion) {
        return Response.json({ error: treinoError ?? "Erro ao gerar treino." }, { status: 422 });
      }

      const nome = String(suggestion.nome);
      const text = `Treino pronto: **${nome}** (${suggestion.grupo_muscular}, ${suggestion.duracao_min} min).\n\nRevise os exercícios e salve em Saúde → Treinos, ou peça ajustes.`;

      return Response.json({
        text,
        module,
        kind: "treino",
        suggestion,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}
Responda como Aura Central coordenando o módulo ${module}. Data de hoje: ${todayIsoDate()}.`,
        },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const text =
      response.choices[0]?.message?.content ?? "Não consegui responder agora.";

    return Response.json({
      text,
      module,
      kind: "chat",
    });
  } catch (error) {
    logCentralError(error);
    const { message, status } = resolveCentralError(error);
    return Response.json({ error: message }, { status });
  }
}
