/**
 * Decision search.
 */

import {
  canViewDecision,
  type DecisionCard,
  type DecisionState,
} from "@/lib/decision-support/types/types";

export function searchDecisionsPure(
  state: DecisionState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): DecisionCard[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.cards
    .filter((c) => canViewDecision(c, viewer))
    .filter((c) => {
      const blob = [
        c.title,
        c.summary,
        c.context,
        c.explanation,
        c.whyAppeared,
        ...c.limitations,
        ...c.evidence.map((e) => e.summary),
        ...c.alternativeOptions.map((a) => a.title),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .slice(0, opts?.limit ?? 30);
}
