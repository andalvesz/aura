import { AiMemoriesRepository } from "@/lib/supabase/repositories/ai-memories.repository";
import type { AiMemory, AiMemoryCategoria, AiModule } from "@/types/database";
import {
  AI_MEMORY_CATEGORY_LABELS,
  buildAuraMemoryTitle,
  formatAuraMemoryDate,
  resolveAuraMemoryCategoria,
  resolveAuraMemoryOrigem,
  shouldPersistAuraMemory,
} from "@/utils/aura-memory";
import {
  isMemoryLeadPriorityQuery,
  isMemoryRecallQuery,
  isMemoryRecommendationQuery,
  isMemorySalesPlanQuery,
  isMemoryWorkoutQuery,
  isMemoryYesterdayQuery,
  truncatePreview,
  yesterdayIsoDate,
} from "@/utils/memory";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

export type ListAuraMemoriesOptions = {
  categoria?: AiMemoryCategoria | "all";
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export async function saveAuraMemory(params: {
  module: AiModule;
  userMessage: string;
  assistantContent: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { module, userMessage, assistantContent, metadata = {} } = params;
  if (!shouldPersistAuraMemory(assistantContent, metadata)) return;

  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  try {
    const repo = new AiMemoriesRepository(ctx.supabase, ctx.userId);
    await repo.append(
      resolveAuraMemoryCategoria(module, metadata),
      buildAuraMemoryTitle(module, userMessage, metadata),
      assistantContent,
      resolveAuraMemoryOrigem(module, metadata)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingSupabaseTableError(message)) {
      console.warn("[ai-memories] Erro ao salvar:", message);
    }
  }
}

export async function listAuraMemories(
  options: ListAuraMemoriesOptions = {}
): Promise<{ memories: AiMemory[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { memories: [], error: "Usuário não autenticado." };
  }

  try {
    const repo = new AiMemoriesRepository(ctx.supabase, ctx.userId);
    const { data, error } = await repo.search(options);
    if (error) return { memories: [], error };
    return { memories: data ?? [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { memories: [], error: message };
  }
}

function formatMemoryLines(memories: AiMemory[], max = 6): string {
  if (memories.length === 0) return "";
  return memories
    .slice(0, max)
    .map(
      (m) =>
        `* [${AI_MEMORY_CATEGORY_LABELS[m.categoria]}] ${m.titulo} (${formatAuraMemoryDate(m.created_at)})\n  ${truncatePreview(m.conteudo, 280)}`
    )
    .join("\n");
}

export async function buildAuraMemoriesContextSection(
  message: string
): Promise<string> {
  if (!isMemoryRecallQuery(message)) return "";

  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  try {
    const repo = new AiMemoriesRepository(ctx.supabase, ctx.userId);
    const sections: string[] = [];

    if (isMemoryYesterdayQuery(message) || isMemoryRecommendationQuery(message)) {
      const yesterday = yesterdayIsoDate();
      const { data } = await repo.findOnDate(yesterday, 12);
      sections.push(
        data?.length
          ? `## MEMÓRIA PERSISTENTE — RECOMENDAÇÕES DE ONTEM (${yesterday})\n${formatMemoryLines(data)}`
          : "## MEMÓRIA PERSISTENTE\nNão há registros salvos de ontem."
      );
    }

    if (isMemoryLeadPriorityQuery(message)) {
      const { data } = await repo.findByKeywords(
        ["lead", "prioriz", "funil", "pipeline", "follow"],
        { limit: 20 }
      );
      const filtered =
        data?.filter(
          (m) => m.categoria === "crescimento" || m.categoria === "mentor" || m.categoria === "coach"
        ) ?? [];
      sections.push(
        filtered.length
          ? `## MEMÓRIA PERSISTENTE — PRIORIDADE DE LEADS\n${formatMemoryLines(filtered)}`
          : "## MEMÓRIA PERSISTENTE\nNenhuma prioridade de leads salva ainda."
      );
    }

    if (isMemoryWorkoutQuery(message)) {
      const { data } = await repo.search({ categoria: "saude", limit: 8 });
      const treinos =
        data?.filter((m) => /treino|exerc|habito|dieta/i.test(`${m.titulo} ${m.conteudo}`)) ?? [];
      sections.push(
        treinos.length
          ? `## MEMÓRIA PERSISTENTE — SAÚDE\n${formatMemoryLines(treinos)}`
          : "## MEMÓRIA PERSISTENTE\nNenhum treino ou rotina salvo na memória."
      );
    }

    if (isMemorySalesPlanQuery(message)) {
      const { data } = await repo.findByKeywords(
        ["vendas", "plano", "estratégia", "estrategia", "funil", "crm"],
        { limit: 20 }
      );
      const plans =
        data?.filter(
          (m) =>
            m.categoria === "crescimento" ||
            m.categoria === "mentor" ||
            m.categoria === "coach"
        ) ?? [];
      sections.push(
        plans.length
          ? `## MEMÓRIA PERSISTENTE — PLANOS DE VENDAS\n${formatMemoryLines(plans)}`
          : "## MEMÓRIA PERSISTENTE\nNenhum plano de vendas salvo ainda."
      );
    }

    if (sections.length === 0) {
      const { data } = await repo.findRecent(8);
      if (data?.length) {
        sections.push(
          `## MEMÓRIA PERSISTENTE — RECENTES\n${formatMemoryLines(data)}`
        );
      }
    }

    return sections.join("\n\n");
  } catch {
    return "";
  }
}

export async function buildAuraMemoryDirectReply(message: string): Promise<string | null> {
  if (!isMemoryRecallQuery(message)) return null;

  const section = await buildAuraMemoriesContextSection(message);
  if (!section) {
    return "Ainda não tenho memórias salvas sobre isso. Converse com a Aura Coach ou Mentor para gerar recomendações.";
  }

  const lines = section
    .replace(/^## MEMÓRIA PERSISTENTE[^\n]*\n?/gm, "")
    .trim();

  if (!lines || lines.includes("Não há") || lines.includes("Nenhum")) {
    return lines.replace(/^\* /gm, "· ").trim() || null;
  }

  const intro = isMemoryYesterdayQuery(message) || isMemoryRecommendationQuery(message)
    ? "Com base na memória persistente, ontem recomendei:"
    : isMemoryLeadPriorityQuery(message)
      ? "Na memória da Aura, sobre prioridade de leads:"
      : isMemoryWorkoutQuery(message)
        ? "Na memória da Aura, sobre treinos e saúde:"
        : isMemorySalesPlanQuery(message)
          ? "Na memória da Aura, sobre planos de vendas:"
          : "Na memória da Aura:";

  const body = lines
    .split("\n")
    .filter((l) => l.startsWith("*"))
    .map((l) => l.replace(/^\* /, "· "))
    .join("\n");

  if (!body) return null;

  const weekHint = await loadWeeklyMemoryHint();
  return `${intro}\n\n${body}${weekHint}`;
}

async function loadWeeklyMemoryHint(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const repo = new AiMemoriesRepository(ctx.supabase, ctx.userId);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const from = weekAgo.toISOString().slice(0, 10);

  const { data } = await repo.search({
    from,
    limit: 30,
  });

  const leadMemories =
    data?.filter(
      (m) =>
        (m.categoria === "crescimento" || m.categoria === "coach" || m.categoria === "mentor") &&
        /lead/i.test(`${m.titulo} ${m.conteudo}`)
    ) ?? [];

  if (leadMemories.length < 2) return "";

  const names = leadMemories
    .slice(0, 2)
    .map((m) => truncatePreview(m.titulo, 40))
    .join(" e ");

  return `\n\nNa última semana também registrei foco em: ${names}.`;
}
