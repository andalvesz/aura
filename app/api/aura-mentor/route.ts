import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import {
  getGrowthLeadsMentorContext,
  getGrowthStrategicMemoryMentorContext,
  recordContentSuggestion,
} from "@/lib/supabase/services/growth.service";
import { getAuraGlobalSummaryMentorContext } from "@/lib/supabase/services/mentor.service";
import {
  getNexusAlveszMentorContext,
  getNexusCalendarMentorContext,
  getNexusDayMentorContext,
  getNexusExecutiveDashboardMentorContext,
} from "@/lib/supabase/services/nexus.service";
import {
  GROWTH_MENTOR_EMPTY_LEADS_MESSAGE,
  isGrowthMentorContentAction,
  isGrowthMentorCrmQuery,
  isGrowthMentorExecutiveQuery,
  isGrowthMentorLeadQuery,
  isGrowthMentorMemoryQuery,
} from "@/utils/growth";
import { isAuraMentorGlobalSummaryQuery } from "@/utils/mentor";
import {
  isNexusAlveszQuery,
  isNexusCalendarQuery,
  isNexusDashboardQuery,
} from "@/utils/nexus";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Você é o Aura Mentor, assistente executivo e comercial estratégico do Aura OS — o sistema operacional pessoal de Anderson Alves. Responda sempre com base nos negócios reais descritos abaixo (memória empresarial permanente).

## USUÁRIO
- Nome: Anderson Alves
- Cidade: Indaiatuba, SP
- Objetivos pessoais e de negócio:
  - Aumentar faturamento
  - Aumentar número de eventos
  - Aumentar vendas de consórcio
  - Crescer no Instagram
  - Fortalecer marca pessoal
  - Transformar a Aura em assistente executivo

## EMPRESA 1 — Alvesz Experience
Empresa especializada em experiências com drinks e bartender para eventos.

Serviços:
- Casamentos
- Aniversários
- Eventos corporativos
- Formaturas
- Festas particulares

Diferenciais:
- Experiência premium
- Atendimento personalizado
- Drinks autorais
- Foco em experiência do cliente

## EMPRESA 2 — Consórcios Ademicon
Parceiro para captação de clientes em consórcios de imóveis, veículos e investimentos.

## MARCA E CANAIS
- Instagram principal: @and.alvesz (marca pessoal de Anderson)
- Alvesz Experience: bartender premium · casamentos · aniversários · eventos corporativos
- Localização estratégica: Indaiatuba, SP e região
- Vendas pela internet e captação via Instagram/WhatsApp

## REGRAS DE PRIORIZAÇÃO DE CONTEXTO
- Perguntas sobre eventos, festas, casamentos, formaturas, bartender, drinks, experiências ou Alvesz Experience → priorize contexto e ações da Alvesz Experience.
- Perguntas sobre crédito, patrimônio, imóveis, veículos, investimentos ou consórcio → priorize contexto e ações de Consórcios.
- Perguntas sobre Instagram, redes sociais ou conteúdo → gere estratégias para @and.alvesz (marca pessoal de Anderson) e para Alvesz Experience; alinhe conteúdo aos dois negócios quando fizer sentido.
- Quando o tema misturar negócios, deixe explícito qual empresa cada recomendação atende.

## DIRETRIZES DE RESPOSTA
- Responda sempre em português do Brasil
- Seja objetivo, prático e orientado a ação
- Estruture respostas com passos claros, listas e recomendações aplicáveis
- Considere o contexto local (Indaiatuba e região) quando relevante
- Foque em vendas, marketing digital, captação de leads e crescimento dos negócios acima
- Quando criar planos, inclua metas, prazos e ações específicas para a semana ou mês
- Quando receber dados de leads do CRM, baseie toda a análise neles — cite nomes, status e valores reais
- NUNCA peça ao usuário para informar leads manualmente quando os dados do CRM já estiverem disponíveis no contexto
- Para análise de leads, priorização ou diagnóstico de funil, use exclusivamente os dados reais do Supabase fornecidos
- Para geração de conteúdo e planejamento semanal, use os insights de nicho derivados do CRM (maior demanda, ticket médio, oportunidades abertas)
- Nunca peça ao usuário para informar nichos ou leads manualmente quando os dados do CRM estiverem disponíveis
- Você é o assistente central da Aura OS: integre Calendário, Crescimento, Alvesz, Saúde, Social Media e Financeiro quando o usuário pedir resumo do dia, prioridades, agenda ou o que fazer hoje
- Para resumo global, gere UMA resposta consolidada com dados reais de todos os módulos — nunca invente informações
- Para "Meu dia", use tarefas (missões), leads prioritários, reuniões (calendário) e metas com dados reais do Supabase
- Para "Dashboard executivo", consolide receita potencial, receita fechada, eventos, leads e missões em um único resumo
- Perguntas sobre Alvesz (orçamentos, clientes, eventos) usam dados do módulo Alvesz Experience
- Perguntas sobre calendário (compromissos, follow-ups, agenda) usam dados do módulo Calendário
- Para "Insights do mês", use memória estratégica: fechamentos, padrões de conversão, aprendizado de conteúdo e alertas de desalinhamento`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function logMentorError(error: unknown) {
  if (error instanceof APIError) {
    console.error("[aura-mentor] OpenAI API error:", {
      status: error.status,
      code: error.code,
      type: error.type,
      message: error.message,
      requestID: error.requestID,
      error: error.error,
    });
    return;
  }

  console.error("[aura-mentor] Unexpected error:", error);
}

function resolveMentorErrorMessage(error: unknown): {
  message: string;
  status: number;
} {
  if (error instanceof APIError) {
    const code = error.code ?? "";

    if (code === "insufficient_quota") {
      return {
        message: "Sua API da OpenAI está sem créditos.",
        status: error.status ?? 429,
      };
    }

    if (code === "invalid_api_key" || error.status === 401) {
      return {
        message: "Chave da OpenAI inválida.",
        status: 401,
      };
    }
  }

  return {
    message: "Erro ao gerar resposta do Aura Mentor.",
    status: 500,
  };
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
      typeof body.actionId === "string" ? body.actionId.trim() : "";
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
      console.error("[aura-mentor] OPENAI_API_KEY não configurada.");
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    let systemPrompt = SYSTEM_PROMPT;
    const isGlobalSummaryQuery = isAuraMentorGlobalSummaryQuery(message, actionId);
    const isMemoryQuery = isGrowthMentorMemoryQuery(message, actionId);
    const isExecutiveQuery = isGrowthMentorExecutiveQuery(message, actionId);
    const isDashboardQuery = isNexusDashboardQuery(message, actionId);
    const isAlveszQuery = isNexusAlveszQuery(message, actionId);
    const isCalendarQuery = isNexusCalendarQuery(message, actionId);
    const isCrmQuery = isGrowthMentorCrmQuery(message, actionId);
    const isPipelineQuery = isGrowthMentorLeadQuery(message, actionId);

    if (isGlobalSummaryQuery) {
      const { context, error } = await getAuraGlobalSummaryMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar resumo global:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para ver seu resumo global."
                : "Não foi possível carregar o resumo global da Aura.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isMemoryQuery) {
      const { context, error } = await getGrowthStrategicMemoryMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar memória estratégica:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para ver os insights do mês."
                : "Não foi possível carregar a memória estratégica.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isExecutiveQuery) {
      const { context, error } = await getNexusDayMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar resumo do dia:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para ver seu resumo do dia."
                : "Não foi possível carregar a central de comando.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isDashboardQuery) {
      const { context, error } = await getNexusExecutiveDashboardMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar dashboard executivo:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para ver o dashboard executivo."
                : "Não foi possível carregar o dashboard Nexus.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isAlveszQuery) {
      const { context, error } = await getNexusAlveszMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar dados Alvesz:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para consultar a Alvesz."
                : "Não foi possível carregar dados da Alvesz Experience.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isCalendarQuery) {
      const { context, error } = await getNexusCalendarMentorContext();

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar calendário:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para consultar sua agenda."
                : "Não foi possível carregar o calendário.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    } else if (isCrmQuery) {
      const { context, error, leadCount } = await getGrowthLeadsMentorContext(
        actionId || undefined
      );

      if (error || !context) {
        console.error("[aura-mentor] Erro ao carregar leads:", error);
        return Response.json(
          {
            error:
              error === "Usuário não autenticado."
                ? "Faça login para analisar seus leads."
                : "Não foi possível carregar os leads do CRM.",
          },
          { status: error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      if (leadCount === 0 && isPipelineQuery) {
        await persistAiTurn("mentor", message, GROWTH_MENTOR_EMPTY_LEADS_MESSAGE);
        return Response.json({ text: GROWTH_MENTOR_EMPTY_LEADS_MESSAGE });
      }

      systemPrompt = `${SYSTEM_PROMPT}\n\n${context}`;
    }

    const mergedHistory = await resolveMergedHistory("mentor", history);

    const messages = await buildOpenAiMessagesWithMemory({
      module: "mentor",
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
      response.choices[0]?.message?.content ?? "Não consegui responder.";

    await persistAiTurn("mentor", message, text, { actionId: actionId || null });

    if (actionId && isGrowthMentorContentAction(actionId)) {
      try {
        await recordContentSuggestion({
          actionId,
          resumo: message,
        });
      } catch (recordError) {
        console.error("[aura-mentor] Erro ao registrar conteúdo:", recordError);
      }
    }

    return Response.json({ text });
  } catch (error) {
    logMentorError(error);

    const { message, status } = resolveMentorErrorMessage(error);

    return Response.json({ error: message }, { status });
  }
}
