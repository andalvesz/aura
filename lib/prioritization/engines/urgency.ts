/**
 * Urgency Prioritizer — ranks by urgency. Never executes.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
  LEVEL_SCORE,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const urgencyPrioritizer: PriorityEngine = {
  id: "urgency_prioritizer_v1",
  kind: "URGENCY",
  label: "Priorizador de urgência",
  description: "Destaca o que parece mais urgente agora — sem prazo imposto.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const scored = [
      ...context.sources.discoveries
        .filter(
          (d) =>
            !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
        )
        .map((d) => ({
          id: d.id,
          title: d.title,
          summary: d.summary,
          confidence: d.confidence,
          impact: parseLevel(d.impact),
          urgency: parseLevel(d.urgency, "HIGH"),
          layer: "discovery" as const,
          type: d.type,
          updatedAt: d.updatedAt,
          score:
            LEVEL_SCORE[parseLevel(d.urgency, "HIGH")] * 20 + d.confidence * 0.2,
        })),
      ...context.sources.decisions
        .filter((d) => !["IGNORED", "ARCHIVED"].includes(d.status ?? ""))
        .map((d) => ({
          id: d.id,
          title: d.title,
          summary: d.summary,
          confidence: d.confidence,
          impact: parseLevel(d.impact),
          urgency: parseLevel(d.urgency, "MEDIUM"),
          layer: "decision" as const,
          type: d.kind,
          updatedAt: d.updatedAt,
          score:
            LEVEL_SCORE[parseLevel(d.urgency, "MEDIUM")] * 18 +
            d.confidence * 0.15,
        })),
    ].sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map((s, index) =>
      buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "urgency_prioritizer_v1",
        kind: "URGENCY",
        title: `Urgente relativo: ${s.title}`,
        summary:
          s.summary ||
          "Sinal com urgência relativa elevada — atenção sugerida, sem ordem de execução.",
        confidence: s.confidence,
        impact: s.impact,
        urgency: s.urgency,
        effort: "MEDIUM",
        reversibility: "HIGH",
        attentionReason: `Urgência ${s.urgency} posicionada #${index + 1} na fila relativa.`,
        evidence: [
          makeEvidence({
            evidenceType: "urgency_signal",
            sourceLayer: s.layer,
            sourceType: s.type,
            sourceId: s.id,
            summary: s.summary || s.title,
            confidence: s.confidence,
          }),
        ],
        limitations: [
          "Urgência relativa entre sinais existentes — não cria deadlines.",
          "Não agenda nem executa.",
        ],
        alternativeViews: [
          {
            id: "alt_impact",
            title: "Priorizar por impacto",
            summary: "Um item menos urgente pode ter mais impacto.",
          },
          {
            id: "alt_ignore_noise",
            title: "Tratar como ruído",
            summary: "Ignorar se a urgência for falsa pressão.",
          },
        ],
        explanation:
          "Urgency Prioritizer ordena atenção temporal relativa. Nunca diz 'faça agora'.",
        criteriaContributed: ["urgency", "recency", "confidence"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("urgency_prioritizer_v1", [s.layer, s.id]),
        relatedDiscovery: s.layer === "discovery" ? s.id : null,
        relatedDecision: s.layer === "decision" ? s.id : null,
        relatedProject:
          context.sources.projects.find((p) => p.status === "active")?.id ??
          null,
        signalObservedAt: s.updatedAt ?? null,
        completenessScore: completeness,
      })
    );
  },
};
