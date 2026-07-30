/**
 * Risk Prioritizer — ranks risk-like attention candidates.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
  LEVEL_SCORE,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const riskPrioritizer: PriorityEngine = {
  id: "risk_prioritizer_v1",
  kind: "RISK",
  label: "Priorizador de riscos",
  description: "Ordena riscos para atenção humana — sem mitigar.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const risks = context.sources.discoveries
      .filter(
        (d) =>
          ["RISK", "DEPENDENCY", "STAGNATION", "CONFLICT"].includes(d.type) &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => ({
        d,
        score:
          d.confidence * 0.45 +
          LEVEL_SCORE[parseLevel(d.impact, "HIGH")] * 18 +
          LEVEL_SCORE[parseLevel(d.urgency, "HIGH")] * 12,
      }))
      .sort((a, b) => b.score - a.score);

    return risks.slice(0, max).map(({ d }, index) =>
      buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "risk_prioritizer_v1",
        kind: "RISK",
        title: `Risco: ${d.title}`,
        summary:
          d.summary ||
          "Risco ranqueado para atenção — sem mitigação automática.",
        confidence: d.confidence,
        impact: parseLevel(d.impact, "HIGH"),
        urgency: parseLevel(d.urgency, "HIGH"),
        effort: "MEDIUM",
        reversibility: "LOW",
        attentionReason: `Risco #${index + 1} por impacto×urgência×confiança.`,
        evidence: [
          makeEvidence({
            evidenceType: "risk_signal",
            sourceLayer: "discovery",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: d.confidence,
          }),
          ...context.sources.worldEntities.slice(0, 1).map((e) =>
            makeEvidence({
              evidenceType: "world_entity",
              sourceLayer: "world",
              sourceType: e.entityType ?? "entity",
              sourceId: e.id,
              summary: e.name,
              confidence: 50,
            })
          ),
        ],
        limitations: [
          "Não mitiga riscos automaticamente.",
          "Não cria alertas de execução nem altera projetos.",
        ],
        alternativeViews: [
          {
            id: "monitor",
            title: "Apenas monitorar",
            summary: "Observar sem elevar prioridade.",
            scoreDelta: -10,
          },
          {
            id: "investigate",
            title: "Investigar evidências",
            summary: "Buscar mais dados antes de priorizar.",
          },
        ],
        explanation:
          "Risk Prioritizer prioriza atenção a riscos. Nunca mitiga nem executa.",
        criteriaContributed: ["impact", "urgency", "confidence", "reversibility"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("risk_prioritizer_v1", [d.id]),
        relatedDiscovery: d.id,
        relatedEntityIds: context.sources.worldEntities.slice(0, 1).map((e) => e.id),
        relatedProject:
          context.sources.projects.find((p) => p.status === "active")?.id ??
          null,
        signalObservedAt: d.updatedAt ?? null,
        completenessScore: completeness,
      })
    );
  },
};
