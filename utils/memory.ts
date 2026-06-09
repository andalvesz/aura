import type { AiMessage, AiModule } from "@/types/database";

export const MEMORY_CONTEXT_LIMIT = 20;

export type MemoryChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const AI_MODULE_LABELS: Record<AiModule, string> = {
  aura_central: "Aura Central",
  mentor: "Aura Mentor",
  agenda: "Aura Agenda",
  saude: "Aura Saúde",
  social: "Aura Social",
  idiomas: "Aura English Coach",
  legado: "Aura Legado",
  creator: "Aura Creator",
  execution: "Aura Execution Engine",
};

const YESTERDAY_PHRASES = [
  "o que conversamos ontem",
  "conversamos ontem",
  "falamos ontem",
  "o que falamos ontem",
] as const;

const GOAL_RECALL_PHRASES = [
  "quais metas eu defini",
  "quais metas defini",
  "meta eu defini",
  "metas que defini",
  "quais metas",
  "minhas metas",
] as const;

const WORKOUT_RECALL_PHRASES = [
  "qual treino você criou",
  "qual treino voce criou",
  "treino você criou",
  "treino voce criou",
  "treino criou para mim",
  "ultimo treino",
  "último treino",
] as const;

const RECOMMENDATION_RECALL_PHRASES = [
  "o que você me recomendou ontem",
  "o que voce me recomendou ontem",
  "me recomendou ontem",
  "recomendou ontem",
  "o que recomendou",
] as const;

const LEAD_PRIORITY_PHRASES = [
  "qual lead eu deveria priorizar",
  "qual lead priorizar",
  "lead eu deveria priorizar",
  "leads priorizar",
  "lead devo priorizar",
  "priorizar lead",
] as const;

const SALES_PLAN_PHRASES = [
  "qual plano de vendas foi gerado",
  "plano de vendas foi gerado",
  "plano de vendas gerado",
  "plano de vendas voce gerou",
  "plano de vendas você gerou",
] as const;

export const EVOLUTION_PHRASES = [
  "como está minha evolução",
  "como esta minha evolucao",
  "minha evolução",
  "minha evolucao",
  "como evolui",
  "como estou evoluindo",
] as const;

function normalizeQuery(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]) {
  return phrases.some((p) => normalized.includes(p));
}

export function isMemoryYesterdayQuery(message: string) {
  return matchesAny(normalizeQuery(message), YESTERDAY_PHRASES);
}

export function isMemoryGoalQuery(message: string) {
  const n = normalizeQuery(message);
  return matchesAny(n, GOAL_RECALL_PHRASES) && !n.includes("receita do mes");
}

export function isMemoryWorkoutQuery(message: string) {
  return matchesAny(normalizeQuery(message), WORKOUT_RECALL_PHRASES);
}

export function isMemoryRecommendationQuery(message: string) {
  return matchesAny(normalizeQuery(message), RECOMMENDATION_RECALL_PHRASES);
}

export function isMemoryLeadPriorityQuery(message: string) {
  return matchesAny(normalizeQuery(message), LEAD_PRIORITY_PHRASES);
}

export function isMemorySalesPlanQuery(message: string) {
  return matchesAny(normalizeQuery(message), SALES_PLAN_PHRASES);
}

export function isMemoryRecallQuery(message: string) {
  return (
    isMemoryYesterdayQuery(message) ||
    isMemoryRecommendationQuery(message) ||
    isMemoryGoalQuery(message) ||
    isMemoryWorkoutQuery(message) ||
    isMemoryLeadPriorityQuery(message) ||
    isMemorySalesPlanQuery(message)
  );
}

export function isAuraEvolutionQuery(message: string) {
  return matchesAny(normalizeQuery(message), EVOLUTION_PHRASES);
}

export function mergeChatHistory(
  stored: MemoryChatMessage[],
  client: MemoryChatMessage[] | undefined,
  limit = MEMORY_CONTEXT_LIMIT
): MemoryChatMessage[] {
  const merged = [...stored, ...(client ?? [])].filter(
    (m) => m.role === "user" || m.role === "assistant"
  );
  return merged.slice(-limit);
}

export function aiMessagesToChat(messages: AiMessage[]): MemoryChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

export function yesterdayIsoDate(reference = new Date()) {
  const d = new Date(reference);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function isMessageOnDate(createdAt: string, isoDate: string) {
  return createdAt.slice(0, 10) === isoDate;
}

export function truncatePreview(text: string, max = 120) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function findLastAssistantMatch(
  messages: AiMessage[],
  patterns: RegExp[]
): AiMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (patterns.some((p) => p.test(msg.content))) return msg;
  }
  return null;
}
