/**
 * Priority Registry — all engines registered; no hardcode in orchestrator.
 */

import {
  confidencePrioritizer,
  impactPrioritizer,
  opportunityPrioritizer,
  reviewPrioritizer,
  riskPrioritizer,
  stalePrioritizer,
  urgencyPrioritizer,
} from "@/lib/prioritization/engines";
import type {
  PriorityContext,
  PriorityEngine,
  PriorityEngineCandidate,
  PriorityEngineId,
  PriorityKind,
} from "@/lib/prioritization/types/types";

const registry = new Map<string, PriorityEngine>();

export function registerPriorityEngine(engine: PriorityEngine): void {
  registry.set(engine.id, engine);
}

export function unregisterPriorityEngine(id: string): void {
  registry.delete(id);
}

export function getPriorityEngine(id: string): PriorityEngine | undefined {
  return registry.get(id);
}

export function listPriorityEngines(): PriorityEngine[] {
  return Array.from(registry.values());
}

export function listPriorityEnginesByKind(kind: PriorityKind): PriorityEngine[] {
  return listPriorityEngines().filter((e) => e.kind === kind);
}

export function clearPriorityRegistry(): void {
  registry.clear();
}

export function ensureBuiltinPriorityEngines(): void {
  const builtins = [
    impactPrioritizer,
    urgencyPrioritizer,
    confidencePrioritizer,
    opportunityPrioritizer,
    riskPrioritizer,
    reviewPrioritizer,
    stalePrioritizer,
  ];
  for (const e of builtins) {
    if (!registry.has(e.id)) registerPriorityEngine(e);
  }
}

export function runPriorityRegistry(
  context: PriorityContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    maxPerEngine?: number;
    engineIds?: PriorityEngineId[];
  }
): {
  candidates: PriorityEngineCandidate[];
  enginesRun: number;
  byEngine: Record<string, number>;
} {
  ensureBuiltinPriorityEngines();
  const engines = listPriorityEngines().filter((e) =>
    options.engineIds ? options.engineIds.includes(e.id) : true
  );

  const candidates: PriorityEngineCandidate[] = [];
  const byEngine: Record<string, number> = {};

  for (const engine of engines) {
    const found = engine.prioritize(context, {
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
