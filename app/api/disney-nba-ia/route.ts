import OpenAI, { APIError } from "openai";
import { persistAiTurn } from "@/lib/ai/memory-runtime";
import { logOpenAiError } from "@/lib/logs/record";
import {
  buildDisneyNbaAiContext,
  computeDisneyNbaDashboard,
  type DisneyNbaAiPromptId,
} from "@/utils/disney-nba";
import type {
  Evento,
  FinancialGoal,
  Goal,
  Gasto,
  LanguageLesson,
  LanguageProgress,
  LanguageSession,
  Trip,
  TripChecklistItem,
} from "@/types/database";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `Você é o assistente da Central Disney + NBA da Aura — coach de preparação para viagem a Orlando (Walt Disney World + NBA Experience).

Responda em português do Brasil, de forma direta, motivadora e prática.
Use APENAS os dados reais fornecidos no contexto. Não invente valores, datas ou progresso.
Organize a resposta com tópicos curtos e ações concretas para esta semana quando relevante.
Integre visão de: finanças, checklist (passaporte, visto, hospedagem, ingressos), inglês e calendário.`;

const PROMPT_MESSAGES: Record<DisneyNbaAiPromptId, string> = {
  semana:
    "Com base nos meus dados reais da viagem Disney + NBA, o que devo priorizar esta semana? Liste ações concretas e ordenadas.",
  orcamento:
    "Analise meu orçamento, economia acumulada e meta mensal da viagem Disney + NBA. Estou no caminho certo? O que ajustar?",
  ingles:
    "Avalie meu progresso de inglês para a viagem Disney + NBA. Estou evoluindo bem? O que praticar agora?",
  faltando:
    "Liste tudo que ainda falta para minha viagem Disney + NBA: documentos, checklist, finanças, inglês e calendário.",
};

function resolveError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Não foi possível consultar a IA da Central Disney + NBA.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      prompt_id?: DisneyNbaAiPromptId;
      trips?: Trip[];
      checklist?: TripChecklistItem[];
      goals?: Goal[];
      financialGoals?: FinancialGoal[];
      gastos?: Gasto[];
      eventos?: Evento[];
      languageProgress?: LanguageProgress | null;
      languageSessions?: LanguageSession[];
      languageLessons?: LanguageLesson[];
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : body.prompt_id
          ? PROMPT_MESSAGES[body.prompt_id]
          : "";

    if (!message) {
      return Response.json({ error: "Informe uma pergunta." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      logOpenAiError("calendario", "OPENAI_API_KEY ausente", "/api/disney-nba-ia");
      return Response.json({ error: "IA indisponível (OPENAI_API_KEY)." }, { status: 503 });
    }

    const dashboard = computeDisneyNbaDashboard({
      trips: body.trips ?? [],
      checklist: body.checklist ?? [],
      goals: body.goals ?? [],
      financialGoals: body.financialGoals ?? [],
      gastos: body.gastos ?? [],
      eventos: body.eventos ?? [],
      languageProgress: body.languageProgress ?? null,
      languageSessions: body.languageSessions ?? [],
      languageLessons: body.languageLessons ?? [],
    });

    const context = buildDisneyNbaAiContext(dashboard);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${context}\n\n---\n\nPergunta: ${message}` },
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return Response.json(
        { error: "Resposta vazia da IA. Tente novamente." },
        { status: 422 }
      );
    }

    await persistAiTurn("agenda", message, reply, { disneyNba: dashboard });

    return Response.json({ reply });
  } catch (error) {
    console.error("[disney-nba-ia]", error);
    logOpenAiError("calendario", error, "/api/disney-nba-ia");
    return Response.json({ error: resolveError(error) }, { status: 500 });
  }
}
