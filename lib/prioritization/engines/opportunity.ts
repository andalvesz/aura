/**
 * Opportunity Prioritizer — ranks opportunity-like signals.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
  LEVEL_SCORE,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const opportunityPrioritizer: PriorityEngine = {
  id: "opportunity_prioritizer_v1",
  kind: "OPPORTUNITY",
  label: "Priorizador de oportunidades",
  description: "Ordena oportunidades candidatas a atenção — sem capturá-las.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const opps = context.sources.discoveries
      .filter(
        (d) =>
          ["OPPORTUNITY", "GAP", "TREND"].includes(d.type) &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => ({
        d,
        score:
          d.confidence * 0.4 +
          LEVEL_SCORE[parseLevel(d.impact)] * 15 +
          LEVEL_SCORE[parseLevel(d.urgency)] * 8,
      }))
      .sort((a, b) => b.score - a.score);

    const fromScenarios = context.sources.scenarios
      .filter((s) => !["ARCHIVED", "DISCARDED"].includes(s.status ?? ""))
      .filter((s) => (s.impact === "HIGH" || s.confidence >= 55))
      .slice(0, 2);

    const out = opps.slice(0, max).map(({ d }, index) => {
      const project = context.sources.projects.find((p) =>
        ["active", "idea", "planning"].includes(p.status)
      );
      const scenario = fromScenarios[0];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "opportunity_prioritizer_v1",
        kind: "OPPORTUNITY",
        title: `Oportunidade: ${d.title}`,
        summary:
          d.summary ||
          "Oportunidade ranqueada para consideração — sem captura automática.",
        confidence: d.confidence,
        impact: parseLevel(d.impact, "HIGH"),
        urgency: parseLevel(d.urgency, "MEDIUM"),
        effort: "MEDIUM",
        reversibility: "HIGH",
        attentionReason: `Oportunidade #${index + 1} por impacto×confiança.`,
        evidence: [
          makeEvidence({
            evidenceType: "opportunity_signal",
            sourceLayer: "discovery",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: d.confidence,
          }),
          ...(scenario
            ? [
                makeEvidence({
                  evidenceType: "scenario_support",
                  sourceLayer: "scenario" as const,
                  sourceType: "scenario",
                  sourceId: scenario.id,
                  summary: scenario.title,
                  confidence: scenario.confidence,
                }),
              ]
            : []),
        ],
        limitations: [
          "Não captura oportunidades automaticamente.",
          "Não cria projetos nem missões.",
        ],
        alternativeViews: [
          {
            id: "alt_risk_first",
            title: "Olhar riscos primeiro",
            summary: "Pode haver riscos que mereçam atenção antes.",
          },
          {
            id: "alt_park",
            title: "Estacionar oportunidade",
            summary: "Manter no radar sem priorizar esta semana.",
          },
        ],
        explanation:
          "Opportunity Prioritizer ranqueia atenção a oportunidades. Nunca executa captura.",
        criteriaContributed: ["impact", "confidence", "reversibility"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("opportunity_prioritizer_v1", [d.id]),
        relatedDiscovery: d.id,
        relatedProject: project?.id ?? null,
        relatedScenario: scenario?.id ?? null,
        relatedBusinessIds: context.sources.businesses.slice(0, 1).map((b) => b.id),
        signalObservedAt: d.updatedAt ?? null,
        completenessScore: completeness,
      });
    });

    return out.slice(0, max);
  },
};
