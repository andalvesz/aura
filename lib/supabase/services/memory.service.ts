import {
  AiMessagesRepository,
  FinancialGoalsRepository,
  GrowthGoalsRepository,
} from "@/lib/supabase/repositories";
import { getAuraCentralFinanceContext } from "@/lib/supabase/services/central.service";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import {
  getAuraGlobalSummaryMentorContext,
  loadAuraGlobalSummaryData,
} from "@/lib/supabase/services/mentor.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import type { AiMessage, AiModule } from "@/types/database";
import { formatBRL } from "@/utils/format";
import {
  AI_MODULE_LABELS,
  aiMessagesToChat,
  findLastAssistantMatch,
  isMemoryGoalQuery,
  isMemoryRecallQuery,
  isMemoryWorkoutQuery,
  isMemoryYesterdayQuery,
  isMessageOnDate,
  MEMORY_CONTEXT_LIMIT,
  mergeChatHistory,
  type MemoryChatMessage,
  truncatePreview,
  yesterdayIsoDate,
} from "@/utils/memory";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";
import { appendAiMessage } from "./ai.service";

export type RecentMemoriesSnapshot = {
  lastConversation: {
    module: AiModule;
    moduleLabel: string;
    preview: string;
    at: string;
  } | null;
  lastGoal: { title: string; detail: string; at: string } | null;
  lastWorkout: { title: string; preview: string; at: string } | null;
  lastAnalysis: { preview: string; moduleLabel: string; at: string } | null;
};

export async function loadAiMemoryHistory(
  module: AiModule,
  limit = MEMORY_CONTEXT_LIMIT
): Promise<MemoryChatMessage[]> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  try {
    const { data, error } = await new AiMessagesRepository(
      ctx.supabase,
      ctx.userId
    ).findRecentForContext(module, limit);

    if (error && !isMissingSupabaseTableError(error)) {
      console.warn("[memory] Erro ao carregar histórico:", error);
    }

    return aiMessagesToChat((data ?? []) as AiMessage[]);
  } catch {
    return [];
  }
}

export async function saveAiExchange(
  module: AiModule,
  userMessage: string,
  assistantContent: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await appendAiMessage(module, "user", userMessage, metadata);
    await appendAiMessage(module, "assistant", assistantContent, metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingSupabaseTableError(message)) {
      console.warn("[memory] Erro ao salvar conversa:", message);
    }
  }
}

export async function buildMemoryRecallSection(
  message: string,
  primaryModule: AiModule
): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx || !isMemoryRecallQuery(message)) return "";

  const repo = new AiMessagesRepository(ctx.supabase, ctx.userId);
  const sections: string[] = [];

  if (isMemoryYesterdayQuery(message)) {
    const yesterday = yesterdayIsoDate();
    const { data } = await repo.findSinceDate(yesterday);
    const dayMessages = ((data ?? []) as AiMessage[]).filter((m) =>
      isMessageOnDate(m.created_at, yesterday)
    );

    if (dayMessages.length === 0) {
      sections.push("## MEMÓRIA\nNão há conversas salvas de ontem.");
    } else {
      const lines = dayMessages.slice(-12).map((m) => {
        const label = m.role === "user" ? "Anderson" : "Aura";
        const mod = AI_MODULE_LABELS[m.module as AiModule] ?? m.module;
        return `* [${mod}] ${label}: ${truncatePreview(m.content, 200)}`;
      });
      sections.push(`## MEMÓRIA — CONVERSAS DE ONTEM (${yesterday})\n${lines.join("\n")}`);
    }
  }

  if (isMemoryGoalQuery(message)) {
    const goalLines: string[] = [];
    const { data: financial } = await new FinancialGoalsRepository(
      ctx.supabase,
      ctx.userId
    ).findAll("data_fim");
    const fin = (financial ?? []).slice(0, 3);
    for (const g of fin) {
      goalLines.push(
        `* Financeiro: "${g.titulo}" — ${formatBRL(Number(g.valor_atual))} / ${formatBRL(Number(g.valor_meta))} (${g.data_inicio} a ${g.data_fim})`
      );
    }

    const { data: growth } = await new GrowthGoalsRepository(
      ctx.supabase,
      ctx.userId
    ).findAll("mes_referencia");
    const gGoal = (growth ?? [])[0];
    if (gGoal) {
      goalLines.push(
        `* Crescimento (${gGoal.mes_referencia}): meta ${formatBRL(Number(gGoal.meta_receita_mensal))}, atual ${formatBRL(Number(gGoal.receita_atual))}`
      );
    }

    const { data: msgs } = await repo.searchContent(["meta", "objetivo"], 8);
    for (const m of (msgs ?? []) as AiMessage[]) {
      goalLines.push(
        `* [${AI_MODULE_LABELS[m.module as AiModule] ?? m.module}] ${truncatePreview(m.content, 160)}`
      );
    }

    sections.push(
      goalLines.length
        ? `## MEMÓRIA — METAS DEFINIDAS\n${goalLines.join("\n")}`
        : "## MEMÓRIA\nNenhuma meta registrada ainda."
    );
  }

  if (isMemoryWorkoutQuery(message)) {
    const { data: saudeMsgs } = await repo.findRecentForContext("saude", 30);
    const treinoMsg = findLastAssistantMatch((saudeMsgs ?? []) as AiMessage[], [
      /treino/i,
      /exerc[ií]cio/i,
      /grupo_muscular/i,
    ]);

    if (treinoMsg) {
      sections.push(
        `## MEMÓRIA — ÚLTIMO TREINO (Aura Saúde)\n${truncatePreview(treinoMsg.content, 600)}`
      );
    } else {
      const { data: centralMsgs } = await repo.findRecentForContext("aura_central", 30);
      const centralTreino = findLastAssistantMatch((centralMsgs ?? []) as AiMessage[], [
        /treino/i,
      ]);
      if (centralTreino) {
        sections.push(
          `## MEMÓRIA — TREINO (Aura Central)\n${truncatePreview(centralTreino.content, 600)}`
        );
      } else {
        sections.push("## MEMÓRIA\nNenhum treino gerado encontrado na memória.");
      }
    }
  }

  if (sections.length === 0 && primaryModule) {
    const { data } = await repo.findRecentForContext(primaryModule, 10);
    const recent = ((data ?? []) as AiMessage[]).slice(-6);
    if (recent.length) {
      const lines = recent.map(
        (m) =>
          `* ${m.role === "user" ? "Anderson" : "Aura"}: ${truncatePreview(m.content, 140)}`
      );
      sections.push(`## MEMÓRIA RECENTE\n${lines.join("\n")}`);
    }
  }

  return sections.join("\n\n");
}

export async function getAuraEvolutionContext(): Promise<string | null> {
  const { context: globalCtx, error } = await getAuraGlobalSummaryMentorContext();
  if (error || !globalCtx) return null;

  const [finance, health, social] = await Promise.all([
    getAuraCentralFinanceContext(),
    getHealthCoachMentorContext(),
    getSocialIaMentorContext(),
  ]);

  const { data } = await loadAuraGlobalSummaryData();
  const activeLeads =
    data?.leads.filter((l) => l.status !== "fechado" && l.status !== "perdido").length ?? 0;

  const parts = [
    "## EVOLUÇÃO — VISÃO CRUZADA (saúde · finanças · conteúdo · vendas · agenda)",
    globalCtx,
    `### Vendas\n- Leads ativos no pipeline: ${activeLeads}`,
    finance.context ? `### Finanças\n${finance.context}` : "",
    health.context ? `### Saúde\n${health.context}` : "",
    social.context ? `### Conteúdo\n${social.context}` : "",
    "Resuma a evolução de Anderson de forma integrada e sugira 3 próximos passos concretos.",
  ].filter(Boolean);

  return parts.join("\n\n");
}

export async function loadRecentMemoriesSnapshot(): Promise<{
  snapshot: RecentMemoriesSnapshot;
  error: string | null;
}> {
  const empty: RecentMemoriesSnapshot = {
    lastConversation: null,
    lastGoal: null,
    lastWorkout: null,
    lastAnalysis: null,
  };

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { snapshot: empty, error: "Usuário não autenticado." };
  }

  try {
    const repo = new AiMessagesRepository(ctx.supabase, ctx.userId);
    const { data: latest } = await repo.findLatestAcrossModules(40);
    const messages = (latest ?? []) as AiMessage[];

    let lastConversation: RecentMemoriesSnapshot["lastConversation"] = null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      const userIdx = messages
        .slice(0, i)
        .reverse()
        .find((m) => m.role === "user" && m.module === msg.module);
      lastConversation = {
        module: msg.module as AiModule,
        moduleLabel: AI_MODULE_LABELS[msg.module as AiModule] ?? msg.module,
        preview: truncatePreview(userIdx?.content ?? msg.content, 100),
        at: msg.created_at,
      };
      break;
    }

    const { data: financialGoals } = await new FinancialGoalsRepository(
      ctx.supabase,
      ctx.userId
    ).findAll("data_fim");
    const finGoal = (financialGoals ?? [])[0];
    const { data: growthGoals } = await new GrowthGoalsRepository(
      ctx.supabase,
      ctx.userId
    ).findAll("mes_referencia");
    const growthGoal = (growthGoals ?? [])[0];

    let lastGoal: RecentMemoriesSnapshot["lastGoal"] = null;
    if (finGoal) {
      lastGoal = {
        title: finGoal.titulo,
        detail: `${formatBRL(Number(finGoal.valor_atual))} / ${formatBRL(Number(finGoal.valor_meta))}`,
        at: finGoal.updated_at,
      };
    } else if (growthGoal) {
      lastGoal = {
        title: `Meta ${growthGoal.mes_referencia}`,
        detail: formatBRL(Number(growthGoal.meta_receita_mensal)),
        at: growthGoal.updated_at,
      };
    }

    const treinoMsg = findLastAssistantMatch(messages, [/treino/i, /exerc/i]);
    const lastWorkout = treinoMsg
      ? {
          title: "Treino sugerido",
          preview: truncatePreview(treinoMsg.content, 100),
          at: treinoMsg.created_at,
        }
      : null;

    const analysisMsg = findLastAssistantMatch(messages, [
      /an[aá]lis/i,
      /insight/i,
      /evolu/i,
      /vendas/i,
      /funil/i,
    ]);
    const lastAnalysis = analysisMsg
      ? {
          preview: truncatePreview(analysisMsg.content, 120),
          moduleLabel: AI_MODULE_LABELS[analysisMsg.module as AiModule] ?? analysisMsg.module,
          at: analysisMsg.created_at,
        }
      : null;

    return {
      snapshot: { lastConversation, lastGoal, lastWorkout, lastAnalysis },
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { snapshot: empty, error: message };
  }
}

export async function resolveMergedHistory(
  module: AiModule,
  clientHistory?: MemoryChatMessage[]
): Promise<MemoryChatMessage[]> {
  const stored = await loadAiMemoryHistory(module);
  return mergeChatHistory(stored, clientHistory);
}
