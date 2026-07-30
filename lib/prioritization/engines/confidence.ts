/**
 * Confidence Prioritizer — elevates high-confidence signals worth attention.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const confidencePrioritizer: PriorityEngine = {
  id: "confidence_prioritizer_v1",
  kind: "CONFIDENCE",
  label: "Priorizador de confiança",
  description:
    "Eleva sinais com evidência mais sólida — atenção informada, sem execução.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const pool = [
      ...context.sources.discoveries.map((d) => ({
        id: d.id,
        title: d.title,
        summary: d.summary,
        confidence: d.confidence,
        impact: parseLevel(d.impact),
        urgency: parseLevel(d.urgency),
        layer: "discovery" as const,
        type: d.type,
        updatedAt: d.updatedAt,
      })),
      ...context.sources.cognitiveArtifacts
        .filter((a) => a.confidence >= 40)
        .map((a) => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          confidence: a.confidence,
          impact: "MEDIUM" as const,
          urgency: "LOW" as const,
          layer: "cognitive" as const,
          type: a.artifactType ?? "artifact",
          updatedAt: undefined as string | undefined,
        })),
      ...context.sources.decisions.map((d) => ({
        id: d.id,
        title: d.title,
        summary: d.summary,
        confidence: d.confidence,
        impact: parseLevel(d.impact),
        urgency: parseLevel(d.urgency),
        layer: "decision" as const,
        type: d.kind,
        updatedAt: d.updatedAt,
      })),
    ]
      .filter((x) => x.confidence >= 45)
      .sort((a, b) => b.confidence - a.confidence);

    return pool.slice(0, max).map((s, index) =>
      buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "confidence_prioritizer_v1",
        kind: "CONFIDENCE",
        title: `Alta confiança: ${s.title}`,
        summary:
          s.summary ||
          "Sinal com confiança elevada — candidato a atenção deliberada.",
        confidence: s.confidence,
        impact: s.impact,
        urgency: s.urgency,
        effort: "LOW",
        reversibility: "HIGH",
        attentionReason: `Confiança ${s.confidence} (#${index + 1} no pool confiável).`,
        evidence: [
          makeEvidence({
            evidenceType: "confidence_signal",
            sourceLayer: s.layer,
            sourceType: s.type,
            sourceId: s.id,
            summary: s.summary || s.title,
            confidence: s.confidence,
          }),
          ...context.sources.memories.slice(0, 1).map((m) =>
            makeEvidence({
              evidenceType: "memory_support",
              sourceLayer: "memory",
              sourceType: "memory",
              sourceId: m.id,
              summary: m.title,
              confidence: m.confidence ?? 50,
            })
          ),
        ],
        limitations: [
          "Alta confiança ≠ necessidade de ação.",
          "Não executa nem recomenda 'faça isto'.",
        ],
        alternativeViews: [
          {
            id: "alt_low_conf",
            title: "Revisar sinais fracos",
            summary: "Itens de baixa confiança podem esconder riscos.",
          },
        ],
        explanation:
          "Confidence Prioritizer destaca onde a evidência é mais sólida para atenção humana.",
        criteriaContributed: ["confidence", "completeness", "effort"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("confidence_prioritizer_v1", [
          s.layer,
          s.id,
        ]),
        relatedDiscovery: s.layer === "discovery" ? s.id : null,
        relatedDecision: s.layer === "decision" ? s.id : null,
        relatedMemoryIds: context.sources.memories.slice(0, 1).map((m) => m.id),
        signalObservedAt: s.updatedAt ?? null,
        completenessScore: completeness,
      })
    );
  },
};
