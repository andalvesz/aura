import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import type { GrowthLead } from "@/types/database";
import {
  isSocialAiAction,
  SOCIAL_AI_CONTEXT,
  type SocialAiAction,
} from "@/utils/social";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTION_DEFAULTS: Record<
  SocialAiAction,
  { mode: "chat" | "calendario" | "ideias" | "roteiro"; message: string }
> = {
  "criar-roteiro-reels": {
    mode: "roteiro",
    message:
      "Crie um roteiro completo para um Reel de alta conversão. Inclua gancho, desenvolvimento, CTA e hashtags.",
  },
  "calendario-semana": {
    mode: "calendario",
    message:
      "Monte o calendário de conteúdo desta semana (Segunda a Domingo) com título, plataforma, formato, objetivo e data para cada item.",
  },
  "ideias-alvesz": {
    mode: "ideias",
    message:
      "Gere 5 ideias de conteúdo para Alvesz Experience: bartender, drinks, casamentos, aniversários e eventos corporativos.",
  },
  "ideias-consorcios": {
    mode: "ideias",
    message:
      "Gere 5 ideias de conteúdo educativo sobre consórcios: imóveis, veículos, investimentos e educação financeira.",
  },
  "ideias-marca-pessoal": {
    mode: "ideias",
    message:
      "Gere 5 ideias de conteúdo para a marca pessoal Anderson Alves: dança, ginástica, teatro, recuperação do ombro, rotina, Disney/NBA.",
  },
  "lead-para-conteudo": {
    mode: "ideias",
    message:
      "Transforme os leads atuais do CRM em ideias de conteúdo personalizadas com gancho e CTA para captação.",
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

function buildLeadContext(lead: GrowthLead): string {
  return `Lead selecionado:
* Nome: ${lead.nome}
* Vertical: ${lead.vertical ?? "—"}
* Status: ${lead.status}
* Contato: ${lead.contato ?? "—"}
* Observações: ${lead.observacoes ?? "—"}

Crie 3 ideias de conteúdo que ajudem a converter ou nutrir este lead, sem expor dados sensíveis publicamente.`;
}

function weekDates(): string[] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      mode?: string;
      actionId?: string;
      history?: unknown;
      leadId?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" && isSocialAiAction(body.actionId.trim())
        ? (body.actionId.trim() as SocialAiAction)
        : null;
    const actionDefaults = actionId ? ACTION_DEFAULTS[actionId] : null;

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
        { error: "IA indisponível (OPENAI_API_KEY). Use o cadastro manual." },
        { status: 503 }
      );
    }

    const { context: dataContext, leads, error: dataError } =
      await getSocialIaMentorContext();

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar a IA Social." }, { status: 401 });
    }

    if (dataError) {
      console.warn("[social-ia] Contexto parcial:", dataError);
    }

    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    const selectedLead = leadId ? leads.find((l) => l.id === leadId) : null;
    const leadSection = selectedLead ? `\n\n${buildLeadContext(selectedLead)}` : "";

    const systemPrompt = `${SOCIAL_AI_CONTEXT}

${dataContext ?? "## DADOS\nNenhum dado disponível."}${leadSection}`;

    const mergedHistory = await resolveMergedHistory("social", history);

    if (mode === "calendario") {
      const dates = weekDates();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}

Responda APENAS JSON:
{
  "resumo": "string curta",
  "conteudos": [
    {
      "titulo": "string",
      "plataforma": "instagram|tiktok|youtube|facebook",
      "formato": "reel|story|post|short|video_longo",
      "objetivo": "string",
      "data": "YYYY-MM-DD",
      "observacoes": "string opcional"
    }
  ]
}
Use estas datas da semana atual: ${dates.join(", ")}. Gere 7 conteúdos (um por dia).`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string" ? parsed.resumo : "Calendário gerado.";

      await persistAiTurn("social", message, text, { kind: "calendario" });

      return Response.json({
        kind: "calendario",
        suggestion: parsed,
        text,
      });
    }

    if (mode === "ideias") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}

Responda APENAS JSON:
{
  "resumo": "string curta",
  "ideias": [
    {
      "titulo": "string",
      "plataforma": "instagram|tiktok|youtube|facebook",
      "formato": "reel|story|post|short|video_longo",
      "objetivo": "string",
      "gancho": "string",
      "observacoes": "string opcional"
    }
  ]
}
Gere entre 5 e 7 ideias práticas.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string" ? parsed.resumo : "Ideias geradas.";

      await persistAiTurn("social", message, text, { kind: "ideias" });

      return Response.json({
        kind: "ideias",
        suggestion: parsed,
        text,
      });
    }

    if (mode === "roteiro") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}

Responda APENAS JSON:
{
  "titulo": "string",
  "plataforma": "instagram",
  "formato": "reel",
  "objetivo": "string",
  "roteiro": "texto completo do roteiro com gancho, desenvolvimento, CTA e hashtags"
}`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.roteiro === "string"
          ? parsed.roteiro
          : "Roteiro gerado.";

      await persistAiTurn("social", message, text, { kind: "roteiro" });

      return Response.json({
        kind: "roteiro",
        suggestion: parsed,
        text,
      });
    }

    const messages = await buildOpenAiMessagesWithMemory({
      module: "social",
      userMessage: message,
      systemPrompt,
      clientHistory: history,
      mergedHistory,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ?? "Não consegui responder agora.";

    await persistAiTurn("social", message, text, { kind: "chat" });

    return Response.json({ kind: "chat", text });
  } catch (error) {
    console.error("[social-ia]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao processar. Tente novamente.") },
      { status: 500 }
    );
  }
}
