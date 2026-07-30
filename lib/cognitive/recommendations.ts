/**
 * Recommendation Engine V1 — non-executable suggestions only.
 */

import { calculateRecommendationConfidence } from "@/lib/cognitive/confidence";
import { hashEvidenceSet } from "@/lib/cognitive/evidence";
import { baseArtifact, fingerprint } from "@/lib/cognitive/patterns";
import {
  METHOD_VERSION,
  type CognitiveArtifact,
  type CognitiveContext,
  type RecommendationType,
} from "@/lib/cognitive/types";

const SAFE_TYPES: RecommendationType[] = [
  "REVIEW",
  "ORGANIZE",
  "CLARIFY",
  "COMPARE",
  "TEST",
  "MONITOR",
  "PAUSE",
  "ARCHIVE",
  "REQUEST_CONFIRMATION",
  "COLLECT_MORE_DATA",
];

export function generateRecommendations(
  context: CognitiveContext,
  insights: CognitiveArtifact[],
  conflicts: CognitiveArtifact[],
  options?: { userId?: string; workspaceId?: string | null; max?: number }
): CognitiveArtifact[] {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const max = options?.max ?? 6;
  const out: CognitiveArtifact[] = [];
  const hasCriticalConflict = conflicts.some(
    (c) => c.structuredContent.nature === "contradiction"
  );

  for (const insight of insights) {
    const recommendationType: RecommendationType =
      insight.confidence < 40
        ? "COLLECT_MORE_DATA"
        : hasCriticalConflict
          ? "CLARIFY"
          : "TEST";

    if (!SAFE_TYPES.includes(recommendationType)) continue;

    const suggestion =
      recommendationType === "COLLECT_MORE_DATA"
        ? "Considere coletar mais dados no mesmo contexto antes de interpretar o padrão como estável."
        : recommendationType === "CLARIFY"
          ? "Considere esclarecer o conflito identificado antes de agir sobre o insight."
          : "Considere testar, de forma limitada e revisável, se o padrão observado se mantém — sem agendar ou executar automaticamente.";

    const conf = calculateRecommendationConfidence({
      insightConfidence: insight.confidence,
      hasCriticalConflict,
      preferenceConfirmed: context.identityContext.claims.some(
        (c) => c.status === "CONFIRMED"
      ),
    });

    const fp = fingerprint([
      "recommendation",
      recommendationType,
      insight.fingerprint,
      METHOD_VERSION,
    ]);

    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "RECOMMENDATION",
        category: recommendationType,
        title: `Sugestão: ${recommendationType}`,
        summary: suggestion,
        structuredContent: {
          recommendationType,
          suggestion,
          reason: insight.summary,
          supportingArtifactIds: [insight.id],
          expectedBenefit: "Melhor base para decisão humana futura",
          possibleCost: "Tempo de revisão",
          uncertainty: "Alta se a amostra for pequena",
          alternatives: ["MONITOR", "REQUEST_CONFIRMATION"],
          requiresConfirmation: true,
        },
        evidence: insight.evidence,
        counterEvidence: insight.counterEvidence,
        assumptions: insight.assumptions,
        alternativeHypotheses: insight.alternativeHypotheses,
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(insight.evidence),
        suppressionKey: `recommendation:${recommendationType}:${insight.suppressionKey}`,
        limitations: [
          "Recomendação não é decisão",
          "executionInfluence: none",
          "Não cria missão, agenda, finanças ou automação",
        ],
        timeRange: insight.timeRange,
        recommendationConfidence: conf,
        insightConfidence: insight.confidence,
        actionability: 30,
      })
    );
  }

  if (context.dataCompleteness.score < 40) {
    const fp = fingerprint(["recommendation", "COLLECT_MORE_DATA", context.correlationId]);
    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "RECOMMENDATION",
        category: "COLLECT_MORE_DATA",
        title: "Sugestão: coletar mais dados",
        summary:
          "A completude do contexto está baixa. Considere revisar memórias, identidade ou o mapa antes de novas interpretações.",
        structuredContent: {
          recommendationType: "COLLECT_MORE_DATA" satisfies RecommendationType,
          suggestion:
            "Considere enriquecer o contexto com fontes confirmadas.",
          reason: `dataCompleteness=${context.dataCompleteness.score}`,
          supportingArtifactIds: [],
          expectedBenefit: "Reduzir INSUFFICIENT_EVIDENCE",
          possibleCost: "Tempo",
          uncertainty: "N/A",
          alternatives: ["MONITOR"],
          requiresConfirmation: true,
        },
        evidence: context.evidenceIndex.slice(0, 3),
        confidence: 35,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(context.evidenceIndex.slice(0, 3)),
        suppressionKey: "recommendation:COLLECT_MORE_DATA:context",
        limitations: ["Sem ação operacional"],
        timeRange: context.temporalContext,
        recommendationConfidence: 35,
      })
    );
  }

  return out.slice(0, max);
}
