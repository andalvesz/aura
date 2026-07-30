/**
 * Decision Registry — all engines registered; no hardcode in orchestrator.
 */

import {
  missingInformationEngine,
  opportunityRankingEngine,
  priorityEngine,
  reviewEngine,
  riskRankingEngine,
  staleDecisionEngine,
  tradeoffEngine,
} from "@/lib/decision-support/engines";
import type {
  DecisionContext,
  DecisionEngine,
  DecisionEngineCandidate,
  DecisionEngineId,
  DecisionKind,
} from "@/lib/decision-support/types/types";

const registry = new Map<string, DecisionEngine>();

export function registerDecisionEngine(engine: DecisionEngine): void {
  registry.set(engine.id, engine);
}

export function unregisterDecisionEngine(id: string): void {
  registry.delete(id);
}

export function getDecisionEngine(id: string): DecisionEngine | undefined {
  return registry.get(id);
}

export function listDecisionEngines(): DecisionEngine[] {
  return Array.from(registry.values());
}

export function listDecisionEnginesByKind(kind: DecisionKind): DecisionEngine[] {
  return listDecisionEngines().filter((e) => e.kind === kind);
}

export function clearDecisionRegistry(): void {
  registry.clear();
}

export function ensureBuiltinDecisionEngines(): void {
  const builtins = [
    priorityEngine,
    tradeoffEngine,
    reviewEngine,
    opportunityRankingEngine,
    riskRankingEngine,
    missingInformationEngine,
    staleDecisionEngine,
  ];
  for (const e of builtins) {
    if (!registry.has(e.id)) registerDecisionEngine(e);
  }
}

export function runDecisionRegistry(
  context: DecisionContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    maxPerEngine?: number;
    engineIds?: DecisionEngineId[];
  }
): {
  candidates: DecisionEngineCandidate[];
  enginesRun: number;
  byEngine: Record<string, number>;
} {
  ensureBuiltinDecisionEngines();
  const engines = listDecisionEngines().filter((e) =>
    options.engineIds ? options.engineIds.includes(e.id) : true
  );

  const candidates: DecisionEngineCandidate[] = [];
  const byEngine: Record<string, number> = {};

  for (const engine of engines) {
    const found = engine.analyze(context, {
      userId: options.userId,
      workspaceId: options.workspaceId ?? null,
      max: options.maxPerEngine ?? 4,
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
