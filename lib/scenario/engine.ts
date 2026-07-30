/**
 * Scenario orchestrator — simulate / what-if / list / get.
 * Never writes to upstream layers. executionInfluence: none
 */

import { buildScenarioContext } from "@/lib/scenario/context/context";
import { runScenarioRegistry } from "@/lib/scenario/registry/registry";
import { filterValidScenarioCandidates } from "@/lib/scenario/validators/validate";
import {
  canViewScenario,
  newScenarioId,
  type ScenarioCard,
  type ScenarioContext,
  type ScenarioEngineId,
  type ScenarioHomeWidget,
  type ScenarioSourceSlice,
  type ScenarioState,
  type ScenarioStatus,
} from "@/lib/scenario/types/types";

function nowIso(): string {
  return new Date().toISOString();
}

export function simulateScenariosPure(
  state: ScenarioState,
  input: {
    userId: string;
    workspaceId?: string | null;
    sources?: Partial<ScenarioSourceSlice>;
    whatIfPrompt?: string | null;
    relatedDecisionId?: string | null;
    relatedProjectId?: string | null;
    engineIds?: ScenarioEngineId[];
    maxPerEngine?: number;
  }
): {
  state: ScenarioState;
  scenarios: ScenarioCard[];
  context: ScenarioContext;
  rejectedCount: number;
} {
  const context = buildScenarioContext({
    sources: input.sources,
    whatIfPrompt: input.whatIfPrompt,
    correlationId: `scn_run_${Date.now()}`,
  });

  const { candidates } = runScenarioRegistry(context, {
    userId: input.userId,
    workspaceId: input.workspaceId,
    maxPerEngine: input.maxPerEngine ?? 4,
    engineIds: input.engineIds,
    whatIfPrompt: input.whatIfPrompt,
    relatedDecisionId: input.relatedDecisionId,
    relatedProjectId: input.relatedProjectId,
  });

  const { valid, rejected } = filterValidScenarioCandidates(candidates);
  const ts = nowIso();
  const existing = new Set(
    state.scenarios
      .filter((c) => !["DISCARDED", "ARCHIVED"].includes(c.status))
      .map((c) => c.fingerprint)
  );

  const fresh: ScenarioCard[] = [];
  for (const c of valid) {
    if (existing.has(c.fingerprint)) continue;
    const card: ScenarioCard = {
      ...c,
      id: newScenarioId("scn"),
      status: "DRAFT",
      visibilityScope: c.visibilityScope ?? "PRIVATE",
      comparisonGroupId: c.comparisonGroupId ?? null,
      executionInfluence: "none",
      createdAt: ts,
      updatedAt: ts,
    };
    fresh.push(card);
    existing.add(c.fingerprint);
  }

  const next: ScenarioState = {
    ...state,
    scenarios: [...fresh, ...state.scenarios].slice(0, 400),
    lastGeneratedAt: ts,
    audit: [
      {
        id: newScenarioId("sau"),
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        scenarioId: null,
        action: input.whatIfPrompt ? "what_if" : "simulate",
        summary: `Gerados ${fresh.length} · rejeitados ${rejected.length}`,
        metadata: {
          executionInfluence: "none",
          readOnly: true,
          whatIfPrompt: input.whatIfPrompt ?? null,
          rejectedCount: rejected.length,
        },
        createdAt: ts,
      },
      ...state.audit,
    ].slice(0, 500),
  };

  return {
    state: next,
    scenarios: fresh,
    context,
    rejectedCount: rejected.length,
  };
}

export function listScenariosPure(
  state: ScenarioState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  opts?: {
    status?: ScenarioStatus | ScenarioStatus[];
    limit?: number;
    includeDiscarded?: boolean;
  }
): ScenarioCard[] {
  let rows = state.scenarios.filter((c) => canViewScenario(c, viewer));
  if (!opts?.includeDiscarded) {
    rows = rows.filter((c) => c.status !== "DISCARDED");
  }
  if (opts?.status) {
    const set = new Set(
      Array.isArray(opts.status) ? opts.status : [opts.status]
    );
    rows = rows.filter((c) => set.has(c.status));
  }
  return [...rows]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, opts?.limit ?? 50);
}

export function getScenarioPure(
  state: ScenarioState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  },
  scenarioId: string
): ScenarioCard | null {
  const card = state.scenarios.find((c) => c.id === scenarioId);
  if (!card || !canViewScenario(card, viewer)) return null;
  return card;
}

export function getHomeScenarioWidgetPure(
  state: ScenarioState,
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): ScenarioHomeWidget {
  return {
    recent: listScenariosPure(state, viewer, { limit: 5 }),
  };
}
