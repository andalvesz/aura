/**
 * Recommendation Registry — all engines registered; no hardcode in orchestrator.
 */

import {
  learningRecommender,
  opportunityRecommender,
  projectRecommender,
  relationshipRecommender,
  reviewRecommender,
  riskRecommender,
} from "@/lib/recommendation/engines";
import type {
  RecommendationContext,
  RecommendationEngine,
  RecommendationEngineCandidate,
  RecommendationEngineId,
  RecommendationType,
} from "@/lib/recommendation/types/types";

const registry = new Map<string, RecommendationEngine>();

export function registerRecommendationEngine(
  engine: RecommendationEngine
): void {
  registry.set(engine.id, engine);
}

export function unregisterRecommendationEngine(id: string): void {
  registry.delete(id);
}

export function getRecommendationEngine(
  id: string
): RecommendationEngine | undefined {
  return registry.get(id);
}

export function listRecommendationEngines(): RecommendationEngine[] {
  return Array.from(registry.values());
}

export function listRecommendationEnginesByType(
  recommendationType: RecommendationType
): RecommendationEngine[] {
  return listRecommendationEngines().filter(
    (e) => e.recommendationType === recommendationType
  );
}

export function clearRecommendationRegistry(): void {
  registry.clear();
}

export function ensureBuiltinRecommendationEngines(): void {
  const builtins = [
    opportunityRecommender,
    riskRecommender,
    projectRecommender,
    learningRecommender,
    relationshipRecommender,
    reviewRecommender,
  ];
  for (const e of builtins) {
    if (!registry.has(e.id)) registerRecommendationEngine(e);
  }
}

export function runRecommendationRegistry(
  context: RecommendationContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    maxPerEngine?: number;
    engineIds?: RecommendationEngineId[];
  }
): {
  candidates: RecommendationEngineCandidate[];
  enginesRun: number;
  byEngine: Record<string, number>;
} {
  ensureBuiltinRecommendationEngines();
  const engines = listRecommendationEngines().filter((e) =>
    options.engineIds ? options.engineIds.includes(e.id) : true
  );

  const candidates: RecommendationEngineCandidate[] = [];
  const byEngine: Record<string, number> = {};

  for (const engine of engines) {
    const found = engine.recommend(context, {
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
