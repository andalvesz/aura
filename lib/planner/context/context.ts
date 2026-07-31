/**
 * Build Planner context — READ-ONLY from upstream layers.
 */

import type { PlanContext, PlanSourceSlice } from "@/lib/planner/types/types";

export function emptyPlanSources(): PlanSourceSlice {
  return {
    identityHints: [],
    memories: [],
    worldEntities: [],
    cognitiveArtifacts: [],
    discoveries: [],
    knowledgeDocuments: [],
    projects: [],
    businesses: [],
    decisions: [],
    scenarios: [],
    priorities: [],
    recommendations: [],
    missions: [],
  };
}

export function buildPlanContext(input: {
  sources?: Partial<PlanSourceSlice>;
  maxItems?: number;
  correlationId?: string;
}): PlanContext {
  const max = input.maxItems ?? 40;
  const raw = { ...emptyPlanSources(), ...input.sources };
  const sources: PlanSourceSlice = {
    identityHints: (raw.identityHints ?? []).slice(0, max),
    memories: (raw.memories ?? []).slice(0, max),
    worldEntities: (raw.worldEntities ?? []).slice(0, max),
    cognitiveArtifacts: (raw.cognitiveArtifacts ?? []).slice(0, max),
    discoveries: (raw.discoveries ?? []).slice(0, max),
    knowledgeDocuments: (raw.knowledgeDocuments ?? []).slice(0, max),
    projects: (raw.projects ?? []).slice(0, max),
    businesses: (raw.businesses ?? []).slice(0, max),
    decisions: (raw.decisions ?? []).slice(0, max),
    scenarios: (raw.scenarios ?? []).slice(0, max),
    priorities: (raw.priorities ?? []).slice(0, max),
    recommendations: (raw.recommendations ?? []).slice(0, max),
    missions: (raw.missions ?? []).slice(0, max),
  };

  const gaps: string[] = [];
  const keys = Object.keys(sources) as (keyof PlanSourceSlice)[];
  for (const k of keys) {
    if (!(sources[k] as unknown[]).length) gaps.push(`no_${k}`);
  }

  const sampleSize = keys.reduce(
    (s, k) => s + (sources[k] as unknown[]).length,
    0
  );
  const filled = keys.filter((k) => (sources[k] as unknown[]).length).length;
  const score = Math.round((filled / keys.length) * 100);

  return {
    sources,
    dataCompleteness: { score, gaps, sampleSize },
    generatedAt: new Date().toISOString(),
    correlationId: input.correlationId ?? `plan_ctx_${Date.now()}`,
    readOnly: true,
    executionInfluence: "none",
  };
}
