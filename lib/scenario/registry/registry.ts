/**
 * Scenario Registry — engines registered; no hardcode in orchestrator.
 */

import {
  comparisonEngine,
  typedScenarioEngines,
  whatIfEngine,
} from "@/lib/scenario/engines";
import type {
  ScenarioContext,
  ScenarioEngine,
  ScenarioEngineCandidate,
  ScenarioEngineId,
} from "@/lib/scenario/types/types";

const registry = new Map<string, ScenarioEngine>();

export function registerScenarioEngine(engine: ScenarioEngine): void {
  registry.set(engine.id, engine);
}

export function unregisterScenarioEngine(id: string): void {
  registry.delete(id);
}

export function getScenarioEngine(id: string): ScenarioEngine | undefined {
  return registry.get(id);
}

export function listScenarioEngines(): ScenarioEngine[] {
  return Array.from(registry.values());
}

export function clearScenarioRegistry(): void {
  registry.clear();
}

export function ensureBuiltinScenarioEngines(): void {
  const builtins = [...typedScenarioEngines, whatIfEngine, comparisonEngine];
  for (const e of builtins) {
    if (!registry.has(e.id)) registerScenarioEngine(e);
  }
}

export function runScenarioRegistry(
  context: ScenarioContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    maxPerEngine?: number;
    engineIds?: ScenarioEngineId[];
    whatIfPrompt?: string | null;
    relatedDecisionId?: string | null;
    relatedProjectId?: string | null;
  }
): {
  candidates: ScenarioEngineCandidate[];
  enginesRun: number;
  byEngine: Record<string, number>;
} {
  ensureBuiltinScenarioEngines();
  const engines = listScenarioEngines().filter((e) =>
    options.engineIds ? options.engineIds.includes(e.id) : true
  );

  const candidates: ScenarioEngineCandidate[] = [];
  const byEngine: Record<string, number> = {};

  for (const engine of engines) {
    const found = engine.simulate(context, {
      userId: options.userId,
      workspaceId: options.workspaceId ?? null,
      max: options.maxPerEngine ?? 4,
      whatIfPrompt: options.whatIfPrompt,
      relatedDecisionId: options.relatedDecisionId,
      relatedProjectId: options.relatedProjectId,
    });
    byEngine[engine.id] = found.length;
    candidates.push(...found);
  }

  return {
    candidates,
    enginesRun: engines.length,
    byEngine,
  };
}
