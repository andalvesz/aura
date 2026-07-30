/**
 * Compare priorities — show score differences. Never picks a winner for execution.
 */

import {
  newPriorityId,
  type PriorityComparison,
  type PriorityItem,
  type PriorityState,
} from "@/lib/prioritization/types/types";

export function comparePrioritiesPure(
  state: PriorityState,
  input: {
    userId: string;
    workspaceId?: string | null;
    priorityIds: string[];
    title?: string;
  }
): {
  state: PriorityState;
  comparison: PriorityComparison | null;
  error: string | null;
} {
  const ids = [...new Set(input.priorityIds)].filter(Boolean);
  if (ids.length < 2) {
    return {
      state,
      comparison: null,
      error: "Selecione pelo menos duas prioridades",
    };
  }

  const items: PriorityItem[] = [];
  for (const id of ids) {
    const item = state.items.find((c) => c.id === id);
    if (!item || item.userId !== input.userId) {
      return { state, comparison: null, error: "Prioridade inválida" };
    }
    items.push(item);
  }

  const leaderScore = Math.max(...items.map((i) => i.priorityScore));
  const scoreDiffs = items
    .map((i) => ({
      priorityId: i.id,
      title: i.title,
      priorityScore: i.priorityScore,
      deltaFromLeader: Math.round((i.priorityScore - leaderScore) * 100) / 100,
      breakdown: i.scoreBreakdown,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const ts = new Date().toISOString();
  const comparison: PriorityComparison = {
    id: newPriorityId("pcmp"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? items[0].workspaceId,
    priorityIds: ids,
    title: input.title?.trim() || `Comparação (${ids.length} prioridades)`,
    scoreDiffs,
    explanation:
      "Comparação transparente de scores. Não escolhe o que fazer e não executa.",
    executionInfluence: "none",
    createdAt: ts,
  };

  return {
    state: {
      ...state,
      comparisons: [comparison, ...state.comparisons].slice(0, 100),
      audit: [
        {
          id: newPriorityId("pau"),
          userId: input.userId,
          workspaceId: comparison.workspaceId,
          priorityId: null,
          action: "compare",
          summary: comparison.title,
          metadata: {
            priorityIds: ids,
            executionInfluence: "none",
          },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    comparison,
    error: null,
  };
}
