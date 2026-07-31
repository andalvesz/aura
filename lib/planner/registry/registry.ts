/**
 * Planner Registry — all engines registered.
 */

import {
  dependencyEngine,
  goalBreakdownEngine,
  milestoneEngine,
  resourcePlanningEngine,
  reviewCadenceEngine,
  riskPlanningEngine,
  stepSequencingEngine,
} from "@/lib/planner/engines";
import type {
  PlanContext,
  PlanDraftProposal,
  PlannerEngine,
  PlannerEngineId,
} from "@/lib/planner/types/types";

const registry = new Map<string, PlannerEngine>();

export function registerPlannerEngine(engine: PlannerEngine): void {
  registry.set(engine.id, engine);
}

export function unregisterPlannerEngine(id: string): void {
  registry.delete(id);
}

export function getPlannerEngine(id: string): PlannerEngine | undefined {
  return registry.get(id);
}

export function listPlannerEngines(): PlannerEngine[] {
  return Array.from(registry.values());
}

export function clearPlannerRegistry(): void {
  registry.clear();
}

export function ensureBuiltinPlannerEngines(): void {
  const builtins = [
    goalBreakdownEngine,
    stepSequencingEngine,
    dependencyEngine,
    resourcePlanningEngine,
    riskPlanningEngine,
    milestoneEngine,
    reviewCadenceEngine,
  ];
  for (const e of builtins) {
    if (!registry.has(e.id)) registerPlannerEngine(e);
  }
}

/** Fixed pipeline order for V1. */
export const PLANNER_PIPELINE_ORDER: PlannerEngineId[] = [
  "goal_breakdown_v1",
  "step_sequencing_v1",
  "dependency_v1",
  "resource_planning_v1",
  "risk_planning_v1",
  "milestone_v1",
  "review_cadence_v1",
];

export function runPlannerRegistry(
  draft: PlanDraftProposal,
  context: PlanContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    engineIds?: PlannerEngineId[];
  }
): { draft: PlanDraftProposal; enginesRun: number } {
  ensureBuiltinPlannerEngines();
  const ids = options.engineIds ?? PLANNER_PIPELINE_ORDER;
  let current = draft;
  let enginesRun = 0;
  for (const id of ids) {
    const engine = registry.get(id);
    if (!engine) continue;
    current = engine.enrich(current, context, {
      userId: options.userId,
      workspaceId: options.workspaceId ?? null,
    });
    enginesRun += 1;
  }
  return { draft: current, enginesRun };
}
