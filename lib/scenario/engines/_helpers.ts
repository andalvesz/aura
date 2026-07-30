/**
 * Shared helpers for Scenario engines.
 */

import {
  newScenarioId,
  type ScenarioEngineCandidate,
  type ScenarioEngineId,
  type ScenarioEvidence,
  type ScenarioImpact,
  type ScenarioType,
} from "@/lib/scenario/types/types";

export function makeEvidence(input: {
  evidenceType: string;
  sourceLayer: ScenarioEvidence["sourceLayer"];
  sourceType: string;
  sourceId: string;
  summary: string;
  confidence?: number;
  used?: boolean;
}): ScenarioEvidence {
  return {
    id: newScenarioId("sev"),
    evidenceType: input.evidenceType,
    sourceLayer: input.sourceLayer,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    summary: input.summary,
    confidence: input.confidence ?? 50,
    observedAt: new Date().toISOString(),
    used: input.used ?? true,
  };
}

export function fingerprintOf(engineId: string, parts: string[]): string {
  return `${engineId}::${parts.join("|")}`.toLowerCase().slice(0, 200);
}

export function buildScenarioCandidate(input: {
  userId: string;
  workspaceId?: string | null;
  engineId: ScenarioEngineId;
  scenarioType: ScenarioType;
  title: string;
  description: string;
  context: string;
  confidence: number;
  impact: ScenarioImpact;
  assumptions: ScenarioEngineCandidate["assumptions"];
  limitations: string[];
  evidence: ScenarioEvidence[];
  alternativeScenarios: ScenarioEngineCandidate["alternativeScenarios"];
  relatedDecisionId?: string | null;
  relatedProjectId?: string | null;
  relatedDiscoveryId?: string | null;
  relatedBusinessId?: string | null;
  relatedDocumentIds?: string[];
  relatedMemoryIds?: string[];
  whatIfPrompt?: string | null;
  ignoredData: string[];
  whyResult: string;
  timeline: ScenarioEngineCandidate["timeline"];
  uncertainty: ScenarioEngineCandidate["uncertainty"];
  fingerprint: string;
}): ScenarioEngineCandidate {
  return {
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    engineId: input.engineId,
    scenarioType: input.scenarioType,
    title: input.title,
    description: input.description,
    context: input.context,
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
    impact: input.impact,
    assumptions: input.assumptions,
    limitations: input.limitations,
    evidence: input.evidence,
    alternativeScenarios: input.alternativeScenarios,
    relatedDecisionId: input.relatedDecisionId ?? null,
    relatedProjectId: input.relatedProjectId ?? null,
    relatedDiscoveryId: input.relatedDiscoveryId ?? null,
    relatedBusinessId: input.relatedBusinessId ?? null,
    relatedDocumentIds: input.relatedDocumentIds ?? [],
    relatedMemoryIds: input.relatedMemoryIds ?? [],
    whatIfPrompt: input.whatIfPrompt ?? null,
    ignoredData: input.ignoredData,
    whyResult: input.whyResult,
    timeline: input.timeline,
    uncertainty: input.uncertainty,
    executionInfluence: "none",
    fingerprint: input.fingerprint,
  };
}

export function baseTimeline(prompt: string): ScenarioEngineCandidate["timeline"] {
  return [
    {
      id: newScenarioId("stl"),
      label: "Premissas",
      phase: "premise",
      summary: `Hipótese inicial: ${prompt.slice(0, 120)}`,
      confidence: 60,
    },
    {
      id: newScenarioId("stl"),
      label: "Curto prazo",
      phase: "near",
      summary: "Primeiros efeitos observáveis da hipótese (simulado).",
      confidence: 55,
    },
    {
      id: newScenarioId("stl"),
      label: "Médio prazo",
      phase: "mid",
      summary: "Ajustes e trade-offs acumulados (simulado).",
      confidence: 45,
    },
    {
      id: newScenarioId("stl"),
      label: "Longo prazo",
      phase: "far",
      summary: "Resultado relativo sob incerteza persistente (simulado).",
      confidence: 35,
    },
  ];
}
