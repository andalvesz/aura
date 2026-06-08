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
import {
  assertOpenAiAvailable,
  generateSocialRoteiro,
} from "@/lib/social/generate-roteiro";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import type { GrowthLead, InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS, MARCA_LABELS } from "@/utils/instagram";
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

type SocialIaMode =
  | "chat"
  | "calendario"
  | "calendario-mes"
  | "ideias"
  | "ideias-stories"
  | "roteiro"
  | "post-hoje"
  | "coach";

const ACTION_DEFAULTS: Record<
  SocialAiAction,
  { mode: SocialIaMode; message: string }
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
  "calendario-mes": {
    mode: "calendario-mes",
    message:
      "Monte o calendário de conteúdo deste mês com título, plataforma, formato, objetivo e data para cada publicação.",
  },
  "ideias-reels": {
    mode: "ideias",
    message:
      "Gere 7 ideias de Reels para Instagram com gancho, objetivo e CTA baseadas nos dados reais.",
  },
  "ideias-stories": {
    mode: "ideias-stories",
    message:
      "Gere 7 ideias de Stories para Instagram com interação, CTA e sequência narrativa.",
  },
  "post-hoje": {
    mode: "post-hoje",
    message: "O que devo postar hoje? Sugira conteúdo concreto com base nos dados reais.",
  },
  "conteudo-atrasado": {
    mode: "coach",
    message:
      "Tenho algum conteúdo atrasado? Liste o que está atrasado e sugira ações para recuperar o calendário.",
  },
  "melhor-resultado": {
    mode: "coach",
    message:
      "Qual conteúdo gera mais resultado? Analise formatos, marcas e pipeline para recomendar o que priorizar.",
  },
  "gravar-semana": {
    mode: "coach",
    message:
      "Qual conteúdo devo gravar esta semana? Liste gravações prioritárias com base em eventos, metas e oportunidades.",
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

function monthDates(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= last; d++) {
    dates.push(new Date(y, m, d).toISOString().slice(0, 10));
  }
  return dates;
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
      marca?: string;
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

    const identityCommand = detectIdentityCommand(message);
    if (identityCommand) {
      const identityResponse = await resolveIdentityCommandResponse({
        message,
        module: "social",
        command: identityCommand,
      });
      if (identityResponse) {
        await persistAiTurn("social", message, identityResponse.text, {
          kind: "identity",
          identityCommand: identityResponse.command,
        });
        return Response.json({
          kind: "identity",
          text: identityResponse.text,
          identityCommand: identityResponse.command,
        });
      }
    }

    const unavailable = assertOpenAiAvailable();
    if (unavailable) {
      return Response.json({ error: unavailable }, { status: 503 });
    }

    const marcaRaw = typeof body.marca === "string" ? body.marca.trim() : "";
    const marca = INSTAGRAM_MARCAS.some((m) => m.id === marcaRaw)
      ? (marcaRaw as InstagramMarca)
      : null;

    const { context: dataContext, leads, error: dataError } =
      await getSocialIaMentorContext({ marca });

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar a IA Social." }, { status: 401 });
    }

    if (dataError) {
      console.warn("[social-ia] Contexto parcial:", dataError);
    }

    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    const selectedLead = leadId ? leads.find((l) => l.id === leadId) : null;
    const leadSection = selectedLead ? `\n\n${buildLeadContext(selectedLead)}` : "";

    const marcaSection = marca
      ? `\n\nMarca ativa: ${MARCA_LABELS[marca]}. Priorize conteúdo para esta marca.`
      : "";

    const systemPrompt = await injectIdentityIntoPrompt(`${SOCIAL_AI_CONTEXT}

${dataContext ?? "## DADOS\nNenhum dado disponível."}${leadSection}${marcaSection}`);

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

    if (mode === "calendario-mes") {
      const dates = monthDates();
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
      "plataforma": "instagram",
      "formato": "reel|story|post",
      "objetivo": "string",
      "data": "YYYY-MM-DD",
      "marca": "marca_pessoal|alvesz|consorcios",
      "observacoes": "string opcional"
    }
  ]
}
Distribua conteúdos ao longo do mês (${dates[0]} a ${dates[dates.length - 1]}). Gere 12 a 16 itens.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string" ? parsed.resumo : "Calendário mensal gerado.";

      await persistAiTurn("social", message, text, { kind: "calendario", marca });

      return Response.json({ kind: "calendario-mes", suggestion: parsed, text });
    }

    if (mode === "ideias-stories") {
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
      "plataforma": "instagram",
      "formato": "story",
      "objetivo": "string",
      "gancho": "string",
      "marca": "marca_pessoal|alvesz|consorcios",
      "observacoes": "string opcional"
    }
  ]
}
Gere 7 ideias de Stories.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string" ? parsed.resumo : "Ideias de Stories geradas.";

      await persistAiTurn("social", message, text, { kind: "ideias", marca });

      return Response.json({ kind: "ideias-stories", suggestion: parsed, text });
    }

    if (mode === "coach") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}

Responda APENAS JSON:
{
  "resumo": "análise executiva respondendo à pergunta do usuário",
  "insights": ["insight 1", "insight 2"],
  "conteudos": [
    {
      "titulo": "string",
      "plataforma": "instagram",
      "formato": "reel|story|post",
      "objetivo": "string",
      "data": "YYYY-MM-DD ou null",
      "marca": "marca_pessoal|alvesz|consorcios",
      "observacoes": "por que esta ação"
    }
  ]
}
Use dados reais: oportunidades automáticas, conteúdos atrasados, relatório social, metas, eventos Alvesz, leads consórcios, viagens Disney/NBA e inglês.
Para "conteúdo atrasado": liste atrasados e sugira replanejamento.
Para "melhor resultado": analise pipeline e formatos publicados.
Para "gravar esta semana": priorize gravações com data desta semana.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string"
          ? parsed.resumo
          : "Análise gerada com base nos seus dados.";

      await persistAiTurn("social", message, text, { kind: "coach", marca });

      return Response.json({ kind: "coach", suggestion: parsed, text });
    }

    if (mode === "post-hoje") {
      const today = new Date().toISOString().slice(0, 10);
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}

Hoje: ${today}

Responda APENAS JSON:
{
  "resumo": "recomendação executiva curta",
  "prioridade": "marca_pessoal|alvesz|consorcios",
  "conteudos": [
    {
      "titulo": "string",
      "plataforma": "instagram",
      "formato": "reel|story|post",
      "objetivo": "string",
      "data": "${today}",
      "marca": "marca_pessoal|alvesz|consorcios",
      "roteiro": "roteiro ou outline curto",
      "observacoes": "por que postar isso hoje com base nos dados"
    }
  ]
}
Sugira 1 a 3 conteúdos para hoje usando leads, eventos, metas e finanças reais.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
      const text =
        typeof parsed.resumo === "string"
          ? parsed.resumo
          : "Sugestão de post para hoje gerada.";

      await persistAiTurn("social", message, text, { kind: "ideias", marca });

      return Response.json({ kind: "post-hoje", suggestion: parsed, text });
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
      const { roteiro, suggestion } = await generateSocialRoteiro({
        titulo: message,
        marca,
        message,
      });

      await persistAiTurn("social", message, roteiro, { kind: "roteiro", marca });

      return Response.json({
        kind: "roteiro",
        suggestion,
        text: roteiro,
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
