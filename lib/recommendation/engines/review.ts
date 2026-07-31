/**
 * Review Recommendation — suggests human review of decisions/scenarios/priorities.
 * Never auto-accepts.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const reviewRecommender: RecommendationEngine = {
  id: "review_recommender_v1",
  recommendationType: "REVIEW",
  label: "Recomendador de revisão",
  description:
    "Sugere decisões, cenários ou prioridades que merecem revisão humana.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const reviewDecisions = context.sources.decisions
      .filter((d) =>
        ["SUGGESTED", "NEEDS_REVIEW", "IN_REVIEW"].includes(d.status ?? "")
      )
      .slice(0, max);

    const reviewPriorities = context.sources.priorities
      .filter((p) =>
        ["SUGGESTED", "NEEDS_REVIEW", "CONFIRMED"].includes(p.status ?? "")
      )
      .slice(0, max);

    const reviewScenarios = context.sources.scenarios
      .filter((s) => !["ARCHIVED", "DISCARDED"].includes(s.status ?? ""))
      .slice(0, 2);

    const candidates: Array<{
      source: "decision" | "priority" | "scenario";
      id: string;
      title: string;
      summary: string;
      confidence: number;
      impact?: string;
      urgency?: string;
      updatedAt?: string;
    }> = [
      ...reviewDecisions.map((d) => ({
        source: "decision" as const,
        id: d.id,
        title: d.title,
        summary: d.summary,
        confidence: d.confidence,
        impact: d.impact,
        urgency: d.urgency,
        updatedAt: d.updatedAt,
      })),
      ...reviewPriorities.map((p) => ({
        source: "priority" as const,
        id: p.id,
        title: p.title,
        summary: p.summary,
        confidence: p.confidence,
        impact: p.impact,
        urgency: p.urgency,
        updatedAt: p.updatedAt,
      })),
      ...reviewScenarios.map((s) => ({
        source: "scenario" as const,
        id: s.id,
        title: s.title,
        summary: s.description || s.title,
        confidence: s.confidence,
        impact: s.impact,
        updatedAt: s.updatedAt,
      })),
    ].slice(0, max);

    return candidates.map((c, index) => {
      const why = `Item #${index + 1} (${c.source}) candidato a revisão humana — sem auto-aceitar.`;
      const evidence = [
        makeEvidence({
          evidenceType: "review_candidate",
          sourceLayer:
            c.source === "decision"
              ? "decision"
              : c.source === "priority"
                ? "prioritization"
                : "scenario",
          sourceType: c.source,
          sourceId: c.id,
          summary: c.summary || c.title,
          confidence: c.confidence,
        }),
      ];
      const alternatives = [
        {
          id: "accept_as_is",
          title: "Manter como está",
          summary: "Não revisar agora; confiar no status atual.",
        },
        {
          id: "deep_review",
          title: "Revisão profunda",
          summary: "Abrir o artefato e analisar evidências detalhadamente.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "review_recommender_v1",
        recommendationType: "REVIEW",
        title: `Revisar: ${c.title}`,
        summary:
          c.summary ||
          "Item sugerido para revisão humana — sem aceitar automaticamente.",
        confidence: c.confidence,
        impact: parseLevel(c.impact, "MEDIUM"),
        urgency: parseLevel(c.urgency, "MEDIUM"),
        effort: "LOW",
        reversibility: "HIGH",
        evidence,
        limitations: [
          "Não aceita nem rejeita artefatos automaticamente.",
          "Não altera Decision / Scenario / Priority status.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: why,
          criteriaWeighted: ["status", "confidence", "urgency"],
          evidenceUsed: evidence.map((e) => e.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Review Recommender sugere revisão humana. Nunca auto-aceita.",
        criteriaContributed: ["confidence", "urgency"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("review_recommender_v1", [c.source, c.id]),
        relatedDecision: c.source === "decision" ? c.id : null,
        relatedPriority: c.source === "priority" ? c.id : null,
        relatedScenario: c.source === "scenario" ? c.id : null,
        signalObservedAt: c.updatedAt ?? null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_decision",
          "read_prioritization",
          "read_scenario",
          "score_review",
          "attach_reasoning",
        ],
      });
    });
  },
};
