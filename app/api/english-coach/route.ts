import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import {
  detectIdentityCommand,
  injectIdentityIntoPrompt,
  resolveIdentityCommandResponse,
} from "@/lib/ai/identity-runtime";
import { getEnglishCoachMentorContext } from "@/lib/supabase/services/english-coach.service";
import {
  saveGeneratedLesson,
  saveGeneratedSession,
} from "@/lib/supabase/services/language.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import type { LanguageModo } from "@/types/database";
import {
  ENGLISH_COACH_CONTEXT,
  detectEnglishModoFromMessage,
  isEnglishCoachAction,
  isValidLanguageModo,
  parseEnglishCorrection,
  parseEnglishLesson,
  type EnglishCoachMode,
} from "@/utils/english";
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
  { mode: EnglishCoachMode; message: string; modo?: LanguageModo }
> = {
  "aula-diaria": {
    mode: "aula_diaria",
    message: "Gere minha aula diária de inglês personalizada para meus objetivos.",
    modo: "viagens",
  },
  vocabulario: {
    mode: "vocabulario",
    message: "Gere vocabulário essencial para minha situação atual.",
    modo: "viagens",
  },
  "frases-uteis": {
    mode: "frases",
    message: "Gere frases úteis em inglês com tradução e contexto.",
    modo: "viagens",
  },
  exercicios: {
    mode: "exercicio",
    message: "Crie exercícios práticos de inglês para eu praticar agora.",
    modo: "viagens",
  },
  correcao: {
    mode: "correcao",
    message: "Corrija minha resposta em inglês e explique os erros.",
    modo: "conversacao_livre",
  },
  "simular-conversa": {
    mode: "conversacao",
    message: "Simule uma conversa em inglês para eu praticar.",
    modo: "disney",
  },
};

function resolveError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return fallback;
}

function buildSystemPrompt(dataContext: string | null): string {
  const dataSection = dataContext
    ? `\n\n${dataContext}`
    : "\n\n## DADOS REAIS\nNenhum dado de inglês cadastrado ainda.";
  return `${ENGLISH_COACH_CONTEXT}${dataSection}`;
}

async function buildSystemPromptWithIdentity(dataContext: string | null): Promise<string> {
  return injectIdentityIntoPrompt(buildSystemPrompt(dataContext));
}

const LESSON_JSON_SCHEMA = `Responda APENAS JSON:
{
  "titulo": "string",
  "introducao": "string",
  "vocabulario": [{"termo":"string","traducao":"string","exemplo":"string"}],
  "frases": [{"ingles":"string","portugues":"string","contexto":"string"}],
  "exercicios": [{"pergunta":"string","opcoes":["string"],"resposta_esperada":"string","dica":"string"}],
  "dicas": ["string"]
}`;

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      mode?: string;
      actionId?: string;
      modo?: string;
      history?: unknown;
      userAnswer?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : "";
    const actionDefaults =
      actionId && isEnglishCoachAction(actionId) ? ACTION_DEFAULTS[actionId] : null;

    let message = typeof body.message === "string" ? body.message.trim() : "";
    let mode: EnglishCoachMode =
      typeof body.mode === "string" && body.mode
        ? (body.mode as EnglishCoachMode)
        : (actionDefaults?.mode ?? "chat");

    let modo: LanguageModo =
      typeof body.modo === "string" && isValidLanguageModo(body.modo)
        ? body.modo
        : (actionDefaults?.modo ?? detectEnglishModoFromMessage(message));

    if (actionDefaults) {
      mode = actionDefaults.mode;
      if (!message || message === actionDefaults.message) {
        message = actionDefaults.message;
      }
      if (actionDefaults.modo) modo = actionDefaults.modo;
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

    const identityCommand = detectIdentityCommand(message);
    if (identityCommand) {
      const identityResponse = await resolveIdentityCommandResponse({
        message,
        module: "idiomas",
        command: identityCommand,
      });
      if (identityResponse) {
        await persistAiTurn("idiomas", message, identityResponse.text, {
          kind: "identity",
          identityCommand: identityResponse.command,
        });
        return Response.json({
          text: identityResponse.text,
          kind: "identity",
          identityCommand: identityResponse.command,
        });
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "IA indisponível (OPENAI_API_KEY)." },
        { status: 503 }
      );
    }

    const { context: dataContext, error: dataError } =
      await getEnglishCoachMentorContext();

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar o English Coach." }, { status: 401 });
    }

    const systemPrompt = await buildSystemPromptWithIdentity(dataContext);
    const mergedHistory = await resolveMergedHistory("idiomas", history);
    const modoLabel = modo;

    if (
      mode === "aula_diaria" ||
      mode === "vocabulario" ||
      mode === "frases" ||
      mode === "exercicio"
    ) {
      const focus =
        mode === "vocabulario"
          ? "Foque em vocabulário."
          : mode === "frases"
            ? "Foque em frases úteis."
            : mode === "exercicio"
              ? "Foque em exercícios práticos."
              : "Gere aula diária completa.";

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nModo: ${modoLabel}\n${focus}\n${LESSON_JSON_SCHEMA}`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = parseEnglishLesson(safeJsonParse(raw, {}));

      const { session } = await saveGeneratedSession({
        modo,
        tipo: mode === "exercicio" ? "exercicio" : mode === "aula_diaria" ? "aula_diaria" : mode === "vocabulario" ? "vocabulario" : "frases",
        titulo: parsed.titulo,
        conteudo: parsed,
      });

      const { lesson } = await saveGeneratedLesson({
        modo,
        titulo: parsed.titulo,
        vocabulario: parsed.vocabulario,
        frases: parsed.frases,
        exercicios: parsed.exercicios,
        sessionId: session?.id ?? null,
      });

      const summary = `Aula gerada: ${parsed.titulo} (${parsed.vocabulario.length} termos, ${parsed.exercicios.length} exercícios)`;
      await persistAiTurn("idiomas", message, summary, { kind: mode, lesson: parsed });

      return Response.json({
        suggestion: parsed,
        kind: mode,
        lessonId: lesson?.id ?? null,
        sessionId: session?.id ?? null,
        text: null,
      });
    }

    if (mode === "correcao") {
      const userAnswer =
        typeof body.userAnswer === "string" ? body.userAnswer.trim() : message;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}
Responda APENAS JSON:
{
  "correcao": "string",
  "explicacao": "string em português",
  "versao_melhorada": "string",
  "nota": number
}`,
          },
          { role: "user", content: `Corrija esta resposta em inglês: ${userAnswer}` },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = parseEnglishCorrection(safeJsonParse(raw, {}));

      await persistAiTurn("idiomas", userAnswer, parsed.correcao, { kind: "correcao" });

      return Response.json({ suggestion: parsed, kind: "correcao", text: null });
    }

    if (mode === "conversacao") {
      const messages = await buildOpenAiMessagesWithMemory({
        module: "idiomas",
        userMessage: message,
        systemPrompt: `${systemPrompt}
Simule uma conversa em inglês no contexto: ${modoLabel}.
Responda em inglês, com tradução em português entre parênteses quando necessário.
Mantenha diálogo natural e desafie o aluno a responder.`,
        clientHistory: history,
        mergedHistory,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
      });

      const text =
        response.choices[0]?.message?.content ?? "Let's practice! How can I help you?";

      await saveGeneratedSession({
        modo,
        tipo: "conversacao",
        titulo: `Conversação — ${modoLabel}`,
        conteudo: { lastMessage: text },
      });

      await persistAiTurn("idiomas", message, text, { kind: "conversacao", modo });

      return Response.json({ text, kind: "conversacao" });
    }

    const messages = await buildOpenAiMessagesWithMemory({
      module: "idiomas",
      userMessage: message,
      systemPrompt: `${systemPrompt}
Você é a Aura English Coach. Responda em português com exemplos em inglês.
Modo ativo: ${modoLabel}.`,
      clientHistory: history,
      mergedHistory,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ??
      "Não consegui responder. Tente novamente.";

    await persistAiTurn("idiomas", message, text, { kind: "chat", modo });

    return Response.json({ text, kind: "chat" });
  } catch (error) {
    console.error("[english-coach]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao consultar o English Coach.") },
      { status: 500 }
    );
  }
}
