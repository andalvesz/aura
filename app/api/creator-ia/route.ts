import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { getCopylabContext } from "@/lib/supabase/services/copylab.service";
import { getCreatorContext } from "@/lib/supabase/services/creator.service";
import { getStudioContext } from "@/lib/supabase/services/creative-studio.service";
import { getLaunchContext } from "@/lib/supabase/services/launch.service";
import { getLandingContext } from "@/lib/supabase/services/landing-builder.service";
import { getAdsContext } from "@/lib/supabase/services/ads-manager.service";
import { getOrchestratorContext } from "@/lib/supabase/services/campaign-orchestrator.service";
import {
  buildBudgetContextBlock,
  getResolvedUserBudget,
} from "@/lib/supabase/services/campaign-budget.service";
import { getResolvedUserLocale } from "@/lib/supabase/services/creator-locale.service";
import { buildLocaleContextBlock } from "@/utils/creator-locale";
import { getResearchContext } from "@/lib/supabase/services/research.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import { COPYLAB_AI_CONTEXT, COPYLAB_IA_ACTIONS } from "@/utils/copylab";
import { CREATOR_AI_CONTEXT, CREATOR_IA_ACTIONS } from "@/utils/creator";
import { STUDIO_AI_CONTEXT, STUDIO_IA_ACTIONS } from "@/utils/creative-studio";
import { LAUNCH_AI_CONTEXT, LAUNCH_IA_ACTIONS } from "@/utils/launch";
import { LANDING_AI_CONTEXT, LANDING_IA_ACTIONS } from "@/utils/landing-builder";
import { ADS_AI_CONTEXT, ADS_IA_ACTIONS } from "@/utils/ads-manager";
import {
  ORCHESTRATOR_AI_CONTEXT,
  ORCHESTRATOR_IA_ACTIONS,
} from "@/utils/campaign-orchestrator";
import { RESEARCH_AI_CONTEXT, RESEARCH_IA_ACTIONS } from "@/utils/research";
import { buildBudgetAskReply, mentionsCampaignInvestment } from "@/utils/campaign-budget";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTION_PROMPTS: Record<string, string> = Object.fromEntries([
  ...CREATOR_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...RESEARCH_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...COPYLAB_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...STUDIO_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...LANDING_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...ADS_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...ORCHESTRATOR_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...LAUNCH_IA_ACTIONS.map((a) => [a.id, a.prompt]),
]);

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

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      actionId?: string;
      history?: unknown;
      module?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : "";
    let message = typeof body.message === "string" ? body.message.trim() : "";
    const isResearch = body.module === "research";
    const isCopylab = body.module === "copylab";
    const isStudio = body.module === "studio";
    const isLanding = body.module === "landing";
    const isAds = body.module === "ads";
    const isOrchestrator = body.module === "orchestrator";
    const isLaunch = body.module === "launch";

    if (actionId && ACTION_PROMPTS[actionId]) {
      message = ACTION_PROMPTS[actionId]!;
    }

    if (!message) {
      return Response.json({ error: "Descreva o que você precisa." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "IA indisponível (OPENAI_API_KEY)." }, { status: 503 });
    }

    const [creatorCtx, researchCtx, copylabCtx, studioCtx, landingCtx, adsCtx, orchestratorCtx, launchCtx] =
      await Promise.all([
        getCreatorContext(),
        getResearchContext(),
        getCopylabContext(),
        getStudioContext(),
        getLandingContext(),
        getAdsContext(),
        getOrchestratorContext(),
        getLaunchContext(),
      ]);

    if (
      creatorCtx.error === "Usuário não autenticado." ||
      researchCtx.error === "Usuário não autenticado." ||
      copylabCtx.error === "Usuário não autenticado." ||
      studioCtx.error === "Usuário não autenticado." ||
      landingCtx.error === "Usuário não autenticado." ||
      adsCtx.error === "Usuário não autenticado." ||
      orchestratorCtx.error === "Usuário não autenticado." ||
      launchCtx.error === "Usuário não autenticado."
    ) {
      return Response.json({ error: "Faça login para usar a Aura Creator." }, { status: 401 });
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

    const { budget } = await getResolvedUserBudget();
    const { locale } = await getResolvedUserLocale();
    const budgetBlock = buildBudgetContextBlock(budget.orcamento);
    const localeBlock = buildLocaleContextBlock(locale);
    const investmentAction =
      actionId === "sugerir-investimento" ||
      actionId === "criar-campanha";
    const needsBudget =
      isAds || isOrchestrator || isLaunch || mentionsCampaignInvestment(message);

    if (
      (investmentAction || mentionsCampaignInvestment(message)) &&
      (budget.orcamento == null || budget.orcamento <= 0)
    ) {
      const kind = isResearch
        ? "research"
        : isCopylab
          ? "copylab"
          : isStudio
            ? "studio"
            : isLanding
              ? "landing"
              : isAds
                ? "ads"
                : isOrchestrator
                  ? "orchestrator"
                  : isLaunch
                    ? "launch"
                    : "creator";
      return Response.json({ text: buildBudgetAskReply(), kind });
    }

    const baseContext = [
      creatorCtx.context,
      researchCtx.context,
      copylabCtx.context,
      studioCtx.context,
      landingCtx.context,
      adsCtx.context,
      orchestratorCtx.context,
      launchCtx.context,
    ]
      .filter(Boolean)
      .join("\n\n");
    const budgetSuffix = needsBudget ? `\n\n${budgetBlock}` : "";
    const localeSuffix = `\n\n${localeBlock}`;
    const systemPrompt = isResearch
      ? `${RESEARCH_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
      : isCopylab
        ? `${COPYLAB_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
        : isStudio
          ? `${STUDIO_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
          : isLanding
            ? `${LANDING_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
            : isAds
              ? `${ADS_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
              : isOrchestrator
                ? `${ORCHESTRATOR_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
                : isLaunch
                  ? `${LAUNCH_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`
                  : `${CREATOR_AI_CONTEXT}\n\n${baseContext || "Sem dados."}${localeSuffix}${budgetSuffix}`;

    const mergedHistory = await resolveMergedHistory("creator", history);

    const messages = await buildOpenAiMessagesWithMemory({
      module: "creator",
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

    const kind = isResearch
      ? "research"
      : isCopylab
        ? "copylab"
        : isStudio
          ? "studio"
          : isLanding
            ? "landing"
            : isAds
              ? "ads"
              : isOrchestrator
                ? "orchestrator"
                : isLaunch
                  ? "launch"
                  : "creator";

    await persistAiTurn("creator", message, text, {
      kind,
      actionId: actionId || undefined,
    });

    return Response.json({ text, kind });
  } catch (error) {
    console.error("[creator-ia]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao processar. Tente novamente.") },
      { status: 500 }
    );
  }
}
