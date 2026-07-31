/**
 * Recommendation search.
 */

import {
  canViewRecommendation,
  type RecommendationCard,
  type RecommendationState,
} from "@/lib/recommendation/types/types";

export function searchRecommendationsPure(
  state: RecommendationState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): RecommendationCard[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.items
    .filter((c) => canViewRecommendation(c, viewer))
    .filter((c) => {
      const blob = [
        c.title,
        c.summary,
        c.explanation,
        c.reasoning.whyAppeared,
        ...c.limitations,
        ...c.criteriaContributed,
        ...c.missingData,
        ...c.evidence.map((e) => e.summary),
        ...c.alternatives.map((a) => a.title),
        ...c.conflicts.map((x) => x.conflictSummary),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .slice(0, opts?.limit ?? 30);
}
