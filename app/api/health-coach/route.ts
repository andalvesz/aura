import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import {
  HEALTH_COACH_CONTEXT,
  isHealthCoachAction,
  todayIsoDate,
} from "@/utils/health";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTION_DEFAULTS: Record<
  string,
  { mode: "chat" | "treino" | "dieta" | "habitos"; message: string }
> = {
  "criar-treino-hoje": {
    mode: "treino",
    message:
      "Crie um treino seguro para hoje, considerando ginástica, dança e lesão no ombro direito. Inclua aquecimento, bloco principal e alongamento.",
  },
  "criar-dieta-simples": {
    mode: "dieta",
    message:
      "Monte uma dieta simples e prática para o dia de hoje, focada em energia e recuperação muscular. Inclua café da manhã, almoço, lanche e jantar.",
  },
  "organizar-habitos": {
    mode: "habitos",
    message:
      "Organize hábitos saudáveis para esta semana: sono, hidratação, mobilidade de ombro, leitura e meditação. Considere rotina de atleta em recuperação.",
  },
  "plano-recuperacao": {
    mode: "chat",
    message:
      "Monte um plano de recuperação leve para lesão no ombro direito, com mobilidade, progressão segura e sinais de alerta para parar.",
  },
  "rotina-atleta": {
    mode: "chat",
    message:
      "Sugira uma rotina de atleta adaptada: ginástica, dança, teatro e treino funcional, respeitando o ombro em recuperação. Inclua descanso e hábitos.",
  },
};

function resolveError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos. Use o cadastro manual.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida. Use o cadastro manual.";
    }
  }
  return fallback;
}

function buildSystemPrompt(dataContext: string | null): string {
  const dataSection = dataContext
    ? `\n\n${dataContext}`
    : "\n\n## DADOS REAIS\nNenhum dado de saúde cadastrado ainda.";
  return `${HEALTH_COACH_CONTEXT}${dataSection}`;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      mode?: string;
      actionId?: string;
      history?: unknown;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : "";
    const actionDefaults =
      actionId && isHealthCoachAction(actionId) ? ACTION_DEFAULTS[actionId] : null;

    let message = typeof body.message === "string" ? body.message.trim() : "";
    let mode =
      typeof body.mode === "string"
        ? body.mode
        : (actionDefaults?.mode ?? "chat");

    if (actionDefaults) {
      mode = actionDefaults.mode;
      if (!message || message === actionDefaults.message) {
        message = actionDefaults.message;
      }
    }

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
      return Response.json({ error: "Descreva o que você precisa." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error:
            "IA indisponível (OPENAI_API_KEY). Cadastre hábitos, treinos e refeições manualmente.",
        },
        { status: 503 }
      );
    }

    const { context: dataContext, error: dataError } =
      await getHealthCoachMentorContext();

    if (dataError && dataError !== "Usuário não autenticado.") {
      console.warn("[health-coach] Contexto parcial:", dataError);
    }

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar a Aura Saúde." }, { status: 401 });
    }

    const systemPrompt = buildSystemPrompt(dataContext);
    const mergedHistory = await resolveMergedHistory("saude", history);

    if (mode === "treino") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}
Responda APENAS JSON:
{
  "nome": "string",
  "grupo_muscular": "string",
  "duracao_min": number,
  "exercicios": [{"nome":"string","series":"string","reps":"string","observacao":"string"}],
  "observacoes": "string ou null"
}
Evite exercícios que sobrecarreguem o ombro direito lesionado.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse(raw, {} as Record<string, unknown>);

      if (!parsed.nome) {
        return Response.json(
          { error: "Não foi possível montar o treino. Tente reformular ou cadastre manualmente." },
          { status: 422 }
        );
      }

      const treinoSummary = `Treino: ${String(parsed.nome)} (${String(parsed.grupo_muscular)}, ${parsed.duracao_min} min)`;
      await persistAiTurn("saude", message, treinoSummary, { kind: "treino", suggestion: parsed });

      return Response.json({ suggestion: parsed, kind: "treino", text: null });
    }

    if (mode === "dieta") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}
Responda APENAS JSON:
{
  "resumo": "string",
  "refeicoes": [
    {"nome":"string","horario":"HH:MM","alimentos":"string","calorias":number|null,"observacoes":"string|null"}
  ]
}
Sugestões alimentares gerais para ${todayIsoDate()}, sem prescrição médica.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse(raw, { refeicoes: [] } as Record<string, unknown>);

      if (!Array.isArray(parsed.refeicoes) || parsed.refeicoes.length === 0) {
        return Response.json(
          { error: "Não foi possível montar a dieta. Tente reformular ou cadastre manualmente." },
          { status: 422 }
        );
      }

      const dietaSummary =
        typeof parsed.resumo === "string"
          ? String(parsed.resumo)
          : "Dieta sugerida para hoje.";
      await persistAiTurn("saude", message, dietaSummary, { kind: "dieta" });

      return Response.json({ suggestion: parsed, kind: "dieta", text: null });
    }

    if (mode === "habitos") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}
Responda APENAS JSON:
{
  "resumo": "string",
  "habitos": [
    {"titulo":"string","frequencia":"diario|semanal|dias_uteis","data":"YYYY-MM-DD"}
  ]
}
Use datas a partir de ${todayIsoDate()} para a semana atual.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse(raw, { habitos: [] } as Record<string, unknown>);

      if (!Array.isArray(parsed.habitos) || parsed.habitos.length === 0) {
        return Response.json(
          {
            error:
              "Não foi possível organizar os hábitos. Tente reformular ou cadastre manualmente.",
          },
          { status: 422 }
        );
      }

      const habitosSummary =
        typeof parsed.resumo === "string"
          ? String(parsed.resumo)
          : "Hábitos organizados para a semana.";
      await persistAiTurn("saude", message, habitosSummary, { kind: "habitos" });

      return Response.json({ suggestion: parsed, kind: "habitos", text: null });
    }

    const messages = await buildOpenAiMessagesWithMemory({
      module: "saude",
      userMessage: message,
      systemPrompt: `${systemPrompt}
Você é a Aura Saúde, assistente central do módulo Saúde. Responda em português do Brasil, com plano prático e seguro.
Para lesão no ombro: cuidado, progressão leve, encaminhar a profissional se houver dor.`,
      clientHistory: history,
      mergedHistory,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ??
      "Não consegui responder. Tente cadastrar manualmente.";

    await persistAiTurn("saude", message, text, { kind: "chat", mode });

    return Response.json({ text, kind: "chat" });
  } catch (error) {
    console.error("[health-coach]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao consultar a Aura Saúde.") },
      { status: 500 }
    );
  }
}
