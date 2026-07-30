/**
 * Comparison engine — structural comparison helper candidates (optional).
 * Primary comparison is done in compareScenariosPure.
 */

import {
  buildScenarioCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/scenario/engines/_helpers";
import { newScenarioId, type ScenarioEngine } from "@/lib/scenario/types/types";

export const comparisonEngine: ScenarioEngine = {
  id: "comparison_v1",
  scenarioType: "COMPARISON",
  label: "Comparação",
  description:
    "Sinaliza necessidade de comparar ramos quando há múltiplas hipóteses ativas.",
  simulate(context, options) {
    if (context.sources.decisions.length < 1 && context.sources.projects.length < 1) {
      return [];
    }
    const prompt =
      options.whatIfPrompt?.trim() ||
      "Comparar caminhos possíveis antes de decidir";
    const project = context.sources.projects[0];
    const decision = context.sources.decisions[0];

    return [
      buildScenarioCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "comparison_v1",
        scenarioType: "NEUTRAL",
        title: `Comparar caminhos: ${prompt.slice(0, 70)}`,
        description:
          "Marco neutro para comparação entre cenários — não escolhe um lado.",
        context: "Use a ação Comparar no Scenario Center para vantagens/desvantagens.",
        confidence: 50,
        impact: "MEDIUM",
        assumptions: [
          {
            id: newScenarioId("asm"),
            statement: "Existem pelo menos dois ramos hipotéticos dignos de contraste.",
            confidence: 55,
          },
        ],
        limitations: [
          "Não elege um cenário vencedor automaticamente.",
          "Comparação é relativa e hipotética.",
        ],
        evidence: [
          makeEvidence({
            evidenceType: "comparison_seed",
            sourceLayer: "scenario",
            sourceType: "comparison",
            sourceId: context.correlationId,
            summary: prompt,
            confidence: 50,
          }),
          ...(project
            ? [
                makeEvidence({
                  evidenceType: "project",
                  sourceLayer: "projects" as const,
                  sourceType: "project",
                  sourceId: project.id,
                  summary: project.name,
                  confidence: 50,
                }),
              ]
            : []),
          ...(decision
            ? [
                makeEvidence({
                  evidenceType: "decision",
                  sourceLayer: "decision" as const,
                  sourceType: decision.kind,
                  sourceId: decision.id,
                  summary: decision.title,
                  confidence: decision.confidence,
                }),
              ]
            : []),
        ],
        alternativeScenarios: [
          {
            id: "alt_best",
            title: "Melhor caso",
            scenarioType: "BEST_CASE",
            summary: "Incluir no contraste",
          },
          {
            id: "alt_worst",
            title: "Pior caso",
            scenarioType: "WORST_CASE",
            summary: "Incluir no contraste",
          },
        ],
        relatedDecisionId: decision?.id ?? null,
        relatedProjectId: project?.id ?? null,
        whatIfPrompt: prompt,
        ignoredData: context.dataCompleteness.gaps.map((g) => `gap:${g}`),
        whyResult:
          "Há âncoras de projeto/decisão suficientes para justificar um contraste explícito entre hipóteses.",
        timeline: [
          {
            id: newScenarioId("stl"),
            label: "Premissas",
            phase: "premise",
            summary: "Definir ramos a comparar",
            confidence: 60,
          },
        ],
        uncertainty: {
          hypotheses: [prompt],
          missingData: context.dataCompleteness.gaps,
          limitations: ["Comparação não executa."],
        },
        fingerprint: fingerprintOf("comparison_v1", [
          prompt.slice(0, 40),
          project?.id ?? "np",
        ]),
      }),
    ];
  },
};
