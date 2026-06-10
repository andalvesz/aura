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
import { getUserLegacyContext } from "@/lib/supabase/services/identity.service";
import {
  getAuraCentralFinanceContext,
  getAuraCentralOpeningSummary,
} from "@/lib/supabase/services/central.service";
import { buildAuraMemoryDirectReply } from "@/lib/supabase/services/ai-memories.service";
import {
  getAuraEvolutionContext,
  resolveMergedHistory,
} from "@/lib/supabase/services/memory.service";
import { isMemoryRecallQuery } from "@/utils/memory";
import {
  getGrowthLeadsMentorContext,
  getGrowthStrategicMemoryMentorContext,
} from "@/lib/supabase/services/growth.service";
import { getEnglishCoachMentorContext } from "@/lib/supabase/services/english-coach.service";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import { getAuraGlobalSummaryMentorContext } from "@/lib/supabase/services/mentor.service";
import {
  getNexusAlveszMentorContext,
  getNexusCalendarMentorContext,
} from "@/lib/supabase/services/nexus.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { loadExecutiveReportData } from "@/lib/supabase/services/reports.service";
import {
  getOptionalDataContext,
  resolveUserDisplayName,
} from "@/lib/supabase/services/context";
import { GROWTH_MENTOR_EMPTY_LEADS_MESSAGE } from "@/utils/growth";
import { todayIsoDate } from "@/utils/health";
import {
  AURA_COACH_ACTION_ID,
  detectCoachMode,
  resolveCoachResponse,
} from "@/utils/coach";
import {
  buildCreatorCoachReply,
  detectCreatorCoachMode,
} from "@/utils/creator";
import {
  buildCopylabCoachReply,
  detectCopylabCoachMode,
} from "@/utils/copylab";
import {
  buildStudioCoachReply,
  detectStudioCoachMode,
} from "@/utils/creative-studio";
import {
  buildLandingCoachReply,
  detectLandingCoachMode,
} from "@/utils/landing-builder";
import {
  buildAdsCoachReply,
  detectAdsCoachMode,
} from "@/utils/ads-manager";
import {
  buildLaunchCoachReply,
  detectLaunchCoachMode,
} from "@/utils/launch";
import {
  buildMoneyCoachReply,
  computeMoneyDashboard,
  detectMoneyCoachMode,
} from "@/utils/money";
import {
  buildCeoCoachReply,
  detectCeoCoachMode,
} from "@/utils/ceo";
import {
  buildPerformanceCoachReply,
  detectPerformanceCoachMode,
} from "@/utils/performance";
import {
  buildResearchCoachReply,
  detectResearchCoachMode,
} from "@/utils/research";
import {
  buildFactoryCoachReply,
  detectFactoryCoachMode,
} from "@/utils/product-factory";
import {
  buildPlatformsCoachReply,
  detectPlatformsCoachMode,
} from "@/utils/platforms";
import {
  buildGlobalCoachReply,
  detectGlobalCoachMode,
} from "@/utils/global";
import {
  buildKnowledgeCoachReply,
  detectKnowledgeCoachMode,
} from "@/utils/knowledge";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { loadLandingRecords } from "@/lib/supabase/services/landing-builder.service";
import { loadAdsCampaigns } from "@/lib/supabase/services/ads-manager.service";
import { getLaunchDashboard } from "@/lib/supabase/services/launch.service";
import { getMoneyDashboard } from "@/lib/supabase/services/money.service";
import { getCeoDashboard } from "@/lib/supabase/services/ceo.service";
import { getPerformanceDashboard } from "@/lib/supabase/services/performance.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import { loadProductFactoryBundles } from "@/lib/supabase/services/product-factory.service";
import { getPlatformsDashboard } from "@/lib/supabase/services/platform-hub.service";
import { getGlobalDashboard } from "@/lib/supabase/services/global-intelligence.service";
import { getKnowledgeDashboard } from "@/lib/supabase/services/knowledge.service";
import { loadLegacyData } from "@/lib/supabase/services/legado.service";
import { runGlobalSearch } from "@/lib/search/global-search";
import {
  generateExecutiveReportAnalysis,
  getExecutiveReport,
} from "@/lib/supabase/services/reports.service";
import {
  extractAuraSearchQuery,
  formatGlobalSearchReply,
  GLOBAL_SEARCH_INITIAL_LIMIT,
  isAuraGlobalSearchQuery,
} from "@/utils/global-search";
import {
  formatReportWithAnalysis,
  isExecutiveReportQuery,
} from "@/utils/executive-reports";
import {
  AURA_CENTRAL_CONTEXT,
  detectAuraCentralIntent,
  type AuraCentralModule,
} from "@/utils/orchestrator";
import { SOCIAL_AI_CONTEXT } from "@/utils/social";
import { parseRequestJson } from "@/utils/safe-json";
import {
  executeAuraCommand,
  listAuraCommandHistory,
  loadAuraCommandParseContext,
  logAuraCommandHistory,
  parseAuraCommand,
} from "@/lib/aura-commands";
import {
  detectAuraCommand,
  formatCommandSuccessMessage,
  isAuraCommandConfirmation,
  type PendingAuraCommand,
} from "@/utils/aura-commands";
import { listCommunicationLogs } from "@/lib/comms";
import { countRecentInboundHint } from "@/lib/comms/gmail.service";
import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { listGrowthLeads } from "@/lib/supabase/services/growth.service";
import { OrcamentosRepository } from "@/lib/supabase/repositories";
import {
  buildCommsCentralReply,
  detectCommsCentralQuery,
} from "@/utils/comms-central";
import { getGmailPublicStatus } from "@/lib/comms/gmail.service";

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
    "Foque em receitas, despesas, saldo, meta financeira e projeção. Liste próximas ações práticas com base nos dados reais.",
  idiomas:
    "Foque em ensino de inglês personalizado: aulas, vocabulário, frases, exercícios e simulação de conversa. Objetivos: viagens, Disney, NBA, aeroporto, hotel e negócios. Responda com exemplos em inglês e explicações em português.",
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
    case "idiomas": {
      const { context, error } = await getEnglishCoachMentorContext();
      return { context, error };
    }
    default:
      return { context: null, error: null };
  }
}

async function handleCommandExecution(
  pending: PendingAuraCommand,
  userMessage: string
) {
  const { result, error: execError } = await executeAuraCommand(pending);

  await logAuraCommandHistory({
    pending,
    result: execError ? null : result,
    status: execError ? "error" : "success",
    errorMessage: execError,
  });

  if (execError) {
    return Response.json({ error: execError }, { status: 422 });
  }

  const text = formatCommandSuccessMessage(pending.commandId, result);
  await persistAiTurn("aura_central", userMessage, text, {
    kind: "command",
    commandId: pending.commandId,
    executed: true,
  });

  return Response.json({
    text,
    module: pending.module,
    kind: "command",
    executed: true,
    result,
    pendingCommand: null,
  });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("history") === "1") {
      const { entries, error } = await listAuraCommandHistory(15);
      if (error) {
        const status = error === "Usuário não autenticado." ? 401 : 500;
        return Response.json({ error }, { status });
      }
      return Response.json({ entries });
    }

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
      pendingCommand?: PendingAuraCommand;
      confirm?: boolean;
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

    const pendingCommand = body.pendingCommand;

    if (pendingCommand && (body.confirm === true || (message && isAuraCommandConfirmation(message)))) {
      return handleCommandExecution(pendingCommand, message || pendingCommand.summary);
    }

    if (!message) {
      return Response.json({ error: "Mensagem não enviada." }, { status: 400 });
    }

    if (isMemoryRecallQuery(message)) {
      const text =
        (await buildAuraMemoryDirectReply(message)) ??
        "Ainda não tenho memórias salvas sobre isso. Use a Aura Coach ou Mentor para gerar recomendações — elas ficarão registradas em Memória.";
      await persistAiTurn("aura_central", message, text, { kind: "memory" });
      return Response.json({
        text,
        module: "global",
        kind: "memory",
      });
    }

    const identityCommand = detectIdentityCommand(message);
    if (identityCommand) {
      const identityResponse = await resolveIdentityCommandResponse({
        message,
        module: "aura_central",
        command: identityCommand,
      });
      if (identityResponse) {
        await persistAiTurn("aura_central", message, identityResponse.text, {
          kind: "identity",
          identityCommand: identityResponse.command,
        });
        return Response.json({
          text: identityResponse.text,
          module: "global",
          kind: "identity",
          identityCommand: identityResponse.command,
        });
      }
    }

    const performanceMode = detectPerformanceCoachMode(message);
    if (performanceMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { dashboard, panel, analysis } = await getPerformanceDashboard();

      if (!dashboard || !panel || !analysis) {
        return Response.json({ error: "Erro ao carregar dados de performance." }, { status: 500 });
      }

      const text = buildPerformanceCoachReply({
        mode: performanceMode,
        displayName,
        dashboard,
        panel,
        analysis,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: performanceMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: performanceMode,
      });
    }

    const ceoMode = detectCeoCoachMode(message);
    if (ceoMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { session, dashboard, radar } = await getCeoDashboard();

      if (!dashboard || !radar) {
        return Response.json({ error: "Erro ao carregar dados CEO." }, { status: 500 });
      }

      const text = buildCeoCoachReply({
        mode: ceoMode,
        displayName,
        session,
        dashboard,
        radar,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: ceoMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: ceoMode,
      });
    }

    const moneyMode = detectMoneyCoachMode(message);
    if (moneyMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { plan, tasks } = await getMoneyDashboard();
      const dashboard = computeMoneyDashboard(plan, tasks);

      const text = buildMoneyCoachReply({
        mode: moneyMode,
        displayName,
        plan,
        tasks,
        dashboard,
        message,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: moneyMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: moneyMode,
      });
    }

    const launchMode = detectLaunchCoachMode(message);
    if (launchMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { center, plans } = await getLaunchDashboard();

      const text = buildLaunchCoachReply({
        mode: launchMode,
        displayName,
        center: center ?? {
          bundle: null,
          pipelineStep: "pesquisa",
          pipelineProgress: {
            pesquisa: false,
            produto: false,
            copy: false,
            criativos: false,
            landing: false,
            anuncios: false,
            lancado: false,
          },
          research: null,
          copy: null,
          plan: null,
        },
        plans: plans ?? [],
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: launchMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: launchMode,
      });
    }

    const copylabMode = detectCopylabCoachMode(message);
    if (copylabMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ records }, { bundles }] = await Promise.all([
        loadCopylabRecords(),
        loadCreatorBundles(),
      ]);

      const text = buildCopylabCoachReply({
        mode: copylabMode,
        displayName,
        records,
        bundles,
        message,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: copylabMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: copylabMode,
      });
    }

    const factoryMode = detectFactoryCoachMode(message);
    if (factoryMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { bundles } = await loadProductFactoryBundles();

      const text = buildFactoryCoachReply({
        mode: factoryMode,
        displayName,
        bundles,
        message,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: factoryMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: factoryMode,
      });
    }

    const platformsMode = detectPlatformsCoachMode(message);
    if (platformsMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { dashboard, products, connections, analyses } = await getPlatformsDashboard();

      const text = buildPlatformsCoachReply({
        mode: platformsMode,
        displayName,
        dashboard,
        products,
        connections,
        analyses,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: platformsMode,
      });

      return Response.json({
        text,
        module: "platforms",
        kind: "coach",
        coachMode: platformsMode,
      });
    }

    const globalMode = detectGlobalCoachMode(message);
    if (globalMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { dashboard, markets, strategies } = await getGlobalDashboard();

      const text = buildGlobalCoachReply({
        mode: globalMode,
        displayName,
        dashboard,
        markets,
        strategies,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: globalMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: globalMode,
      });
    }

    const knowledgeMode = detectKnowledgeCoachMode(message);
    if (knowledgeMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const { dashboard, entries, patterns, insights } = await getKnowledgeDashboard();

      const text = buildKnowledgeCoachReply({
        mode: knowledgeMode,
        displayName,
        dashboard,
        entries,
        patterns,
        insights,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: knowledgeMode,
      });

      return Response.json({
        text,
        module: "knowledge",
        kind: "coach",
        coachMode: knowledgeMode,
      });
    }

    const studioMode = detectStudioCoachMode(message);
    if (studioMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ records }, { bundles }] = await Promise.all([
        loadStudioAssets(),
        loadCreatorBundles(),
      ]);

      const text = buildStudioCoachReply({
        mode: studioMode,
        displayName,
        records,
        bundles,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: studioMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: studioMode,
      });
    }

    const landingMode = detectLandingCoachMode(message);
    if (landingMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ records }, { bundles }] = await Promise.all([
        loadLandingRecords(),
        loadCreatorBundles(),
      ]);

      const text = buildLandingCoachReply({
        mode: landingMode,
        displayName,
        records,
        bundles,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: landingMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: landingMode,
      });
    }

    const adsMode = detectAdsCoachMode(message);
    if (adsMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ records }, { bundles }] = await Promise.all([
        loadAdsCampaigns(),
        loadCreatorBundles(),
      ]);

      const text = buildAdsCoachReply({
        mode: adsMode,
        displayName,
        records,
        bundles,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: adsMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: adsMode,
      });
    }

    const researchMode = detectResearchCoachMode(message);
    if (researchMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ records }, legacyRes] = await Promise.all([
        loadResearchRecords(),
        loadLegacyData(),
      ]);

      const text = buildResearchCoachReply({
        mode: researchMode,
        displayName,
        records,
        legacyData: legacyRes.data,
        message,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: researchMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: researchMode,
      });
    }

    const creatorMode = detectCreatorCoachMode(message);
    if (creatorMode) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }

      const displayName = await resolveUserDisplayName(ctx);
      const [{ bundles }, legacyRes] = await Promise.all([
        loadCreatorBundles(),
        loadLegacyData(),
      ]);

      const text = buildCreatorCoachReply({
        mode: creatorMode,
        displayName,
        bundles,
        legacyData: legacyRes.data,
      });

      await persistAiTurn("aura_central", message, text, {
        kind: "coach",
        coachMode: creatorMode,
      });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: creatorMode,
      });
    }

    const coachMode = detectCoachMode(message, actionId);
    if (coachMode) {
      if (coachMode === "intro") {
        const ctx = await getOptionalDataContext();
        const displayName = ctx ? await resolveUserDisplayName(ctx) : "Anderson";
        const { text } = resolveCoachResponse("intro", {
          clientes: [],
          orcamentos: [],
          eventos: [],
          leads: [],
          goal: null,
          missions: [],
          alveszAvailable: true,
          calendarAvailable: true,
          conteudos: [],
          gastos: [],
          healthHabits: [],
          healthWorkouts: [],
          healthMeals: [],
          healthSessions: [],
          socialAvailable: true,
          financeAvailable: true,
          healthAvailable: true,
          financialIncome: [],
          financialGoals: [],
          financialBalance: null,
          alveszEventos: [],
          weekMemories: [],
          goals: [],
          auraXp: null,
          notifications: [],
          languageProgress: null,
          languageSessions: [],
          languageLessons: [],
          communicationLogs: [],
        }, displayName);
        await persistAiTurn("aura_central", message, text, { kind: "coach", coachMode });
        return Response.json({ text, module: "global", kind: "coach", coachMode });
      }

      const { data: coachData, error: coachError } = await loadExecutiveReportData();
      if (coachError === "Usuário não autenticado.") {
        return Response.json({ error: "Faça login para usar a Aura Coach." }, { status: 401 });
      }
      if (coachError || !coachData) {
        return Response.json(
          { error: coachError ?? "Não foi possível carregar dados para a Aura Coach." },
          { status: 500 }
        );
      }

      const ctx = await getOptionalDataContext();
      const displayName = ctx ? await resolveUserDisplayName(ctx) : "Anderson";
      let { text, mode } = resolveCoachResponse(coachMode, coachData, displayName);

      if (coachMode === "goals" || coachMode === "goals-late") {
        const { context: legacyContext } = await getUserLegacyContext();
        if (legacyContext) {
          text += `\n\n---\n**Conexão com sua trajetória:** suas metas se alinham com a evolução registrada no Legado — ginástica, dança, Alvesz, Aura e liberdade financeira. Use essa história como combustível.`;
        }
      }

      await persistAiTurn("aura_central", message, text, { kind: "coach", coachMode: mode });

      return Response.json({
        text,
        module: "global",
        kind: "coach",
        coachMode: mode,
      });
    }

    const reportType = isExecutiveReportQuery(message);
    if (reportType) {
      const { report, error: reportError } = await getExecutiveReport(reportType);
      if (reportError || !report) {
        const status = reportError === "Usuário não autenticado." ? 401 : 500;
        return Response.json({ error: reportError ?? "Erro ao gerar relatório." }, { status });
      }

      const { analysis } = await generateExecutiveReportAnalysis(reportType, report);
      const text = formatReportWithAnalysis(report, analysis);

      await persistAiTurn("aura_central", message, text, {
        kind: "report",
        reportType,
      });

      return Response.json({
        text,
        module: "global",
        kind: "report",
        reportType,
        report,
        analysis,
      });
    }

    if (isAuraGlobalSearchQuery(message)) {
      const searchQuery = extractAuraSearchQuery(message);
      if (!searchQuery) {
        return Response.json({
          text: 'Use "Buscar", "Procure" ou "Busque" seguido do termo (ex.: Procure Mariana). Mínimo 2 caracteres.',
          module: "global",
          kind: "search",
          searchResults: [],
          searchQuery: "",
          total: 0,
        });
      }

      const { results, total, error: searchError } = await runGlobalSearch(searchQuery, {
        filter: "todos",
        page: 0,
        limit: GLOBAL_SEARCH_INITIAL_LIMIT,
      });

      if (searchError) {
        const status = searchError === "Usuário não autenticado." ? 401 : 400;
        return Response.json({ error: searchError }, { status });
      }

      const text = formatGlobalSearchReply(results, searchQuery, total);
      await persistAiTurn("aura_central", message, text, {
        kind: "search",
        searchQuery,
        total,
      });

      return Response.json({
        text,
        module: "global",
        kind: "search",
        searchResults: results,
        searchQuery,
        total,
      });
    }

    const commsQuery = detectCommsCentralQuery(message);
    if (commsQuery) {
      const ctx = await getOptionalDataContext();
      if (!ctx) {
        return Response.json({ error: "Faça login para usar a Aura Central." }, { status: 401 });
      }

      const [leadsRes, orcRes, clientesRes, logsRes, gmailStatus, inboundCount] =
        await Promise.all([
          listGrowthLeads(),
          new OrcamentosRepository(ctx.supabase, ctx.userId).findAll(),
          listClientes(),
          listCommunicationLogs(100),
          getGmailPublicStatus(),
          countRecentInboundHint().catch(() => 0),
        ]);

      const text = buildCommsCentralReply({
        query: commsQuery,
        logs: logsRes.data ?? [],
        leads: leadsRes.data ?? [],
        orcamentos: orcRes.data ?? [],
        clientes: clientesRes.data ?? [],
        gmailConnected: gmailStatus.connected,
        recentInboundCount: inboundCount,
      });

      await persistAiTurn("aura_central", message, text, { kind: "comms", commsQuery });

      return Response.json({
        text,
        module: "global",
        kind: "comms",
        commsQuery,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const commandId =
      actionId === "marcar-reuniao"
        ? ("calendario.criar-evento" as const)
        : actionId === "treino-hoje"
          ? ("saude.criar-treino" as const)
          : detectAuraCommand(message);

    if (commandId) {
      const { context: parseContext, error: ctxError } =
        await loadAuraCommandParseContext();

      if (ctxError === "Usuário não autenticado.") {
        return Response.json({ error: "Faça login para usar comandos." }, { status: 401 });
      }
      if (ctxError || !parseContext) {
        return Response.json(
          { error: ctxError ?? "Não foi possível carregar contexto." },
          { status: 500 }
        );
      }

      const { pending, error: parseError } = await parseAuraCommand(
        commandId,
        message,
        parseContext
      );

      if (parseError || !pending) {
        return Response.json(
          { error: parseError ?? "Não entendi o comando." },
          { status: 422 }
        );
      }

      await persistAiTurn("aura_central", message, pending.confirmText, {
        kind: "command",
        commandId: pending.commandId,
        pending: true,
      });

      return Response.json({
        text: pending.confirmText,
        module: pending.module,
        kind: "command",
        pendingCommand: pending,
        executed: false,
      });
    }

    const intent = detectAuraCentralIntent(message, actionId);
    const { module, mode } = intent;

    const mergedHistory = await resolveMergedHistory("aura_central", history);

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
      await persistAiTurn("aura_central", message, GROWTH_MENTOR_EMPTY_LEADS_MESSAGE, {
        module,
      });
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

    const evolutionContext =
      actionId === "evolucao" ? await getAuraEvolutionContext() : null;

    const systemPrompt = await injectIdentityIntoPrompt(`${AURA_CENTRAL_CONTEXT}

## MÓDULO ATIVO: ${module.toUpperCase()}
${MODULE_INSTRUCTIONS[module]}

${dataContext ?? "## DADOS\nNenhum dado cadastrado ainda para este módulo."}`);

    const extraSections = evolutionContext ? [evolutionContext] : [];

    const messages = await buildOpenAiMessagesWithMemory({
      module: "aura_central",
      userMessage: message,
      systemPrompt: `${systemPrompt}
Responda como Aura Central coordenando o módulo ${module}. Data de hoje: ${todayIsoDate()}.`,
      clientHistory: history,
      mergedHistory,
      extraSections,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ?? "Não consegui responder agora.";

    await persistAiTurn("aura_central", message, text, { module, kind: "chat" });

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
