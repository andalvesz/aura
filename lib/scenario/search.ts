/**
 * Scenario search.
 */

import {
  canViewScenario,
  type ScenarioCard,
  type ScenarioState,
} from "@/lib/scenario/types/types";

export function searchScenariosPure(
  state: ScenarioState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  query: string,
  opts?: { limit?: number }
): ScenarioCard[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return state.scenarios
    .filter((c) => canViewScenario(c, viewer))
    .filter((c) => {
      const blob = [
        c.title,
        c.description,
        c.context,
        c.whatIfPrompt ?? "",
        c.whyResult,
        ...c.assumptions.map((a) => a.statement),
        ...c.limitations,
        ...c.evidence.map((e) => e.summary),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .slice(0, opts?.limit ?? 30);
}
