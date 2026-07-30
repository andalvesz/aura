/**
 * Priority search.
 */

import {
  canViewPriority,
  type PriorityItem,
  type PriorityState,
} from "@/lib/prioritization/types/types";

export function searchPrioritiesPure(
  state: PriorityState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): PriorityItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.items
    .filter((c) => canViewPriority(c, viewer))
    .filter((c) => {
      const blob = [
        c.title,
        c.summary,
        c.attentionReason,
        c.explanation,
        ...c.limitations,
        ...c.criteriaContributed,
        ...c.missingData,
        ...c.evidence.map((e) => e.summary),
        ...c.alternativeViews.map((a) => a.title),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .slice(0, opts?.limit ?? 30);
}
