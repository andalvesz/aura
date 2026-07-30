/**
 * Insight Engine V1 — calibrated interpretations from patterns.
 */

import {
  calculateInsightConfidence,
  calibratedLanguage,
  confidenceBand,
} from "@/lib/cognitive/confidence";
import { hashEvidenceSet } from "@/lib/cognitive/evidence";
import { baseArtifact, fingerprint } from "@/lib/cognitive/patterns";
import {
  METHOD_VERSION,
  type CognitiveArtifact,
  type CognitiveContext,
} from "@/lib/cognitive/types";

export function generateInsights(
  context: CognitiveContext,
  patterns: CognitiveArtifact[],
  hypotheses: CognitiveArtifact[],
  options?: { userId?: string; workspaceId?: string | null; max?: number }
): CognitiveArtifact[] {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const max = options?.max ?? 6;
  const out: CognitiveArtifact[] = [];

  for (const pattern of patterns) {
    const sampleSize =
      typeof pattern.structuredContent.sampleSize === "number"
        ? pattern.structuredContent.sampleSize
        : context.dataCompleteness.sampleSize;
    const band = confidenceBand(pattern.confidence);
    const observation = `Dentro do período analisado, ${calibratedLanguage(band)} associação descrita em "${pattern.title}".`;
    const summary = `${observation} Isso não significa causalidade.`;

    const relatedHyp = hypotheses.find(
      (h) => h.structuredContent.sourcePatternId === pattern.id
    );

    const conf = calculateInsightConfidence({
      patternConfidence: pattern.confidence,
      evidence: pattern.evidence,
      hasCausalLanguage: false,
      sampleSmall: sampleSize < 3,
    });

    const fp = fingerprint(["insight", pattern.fingerprint, METHOD_VERSION]);

    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "INSIGHT",
        category: pattern.category,
        title: `Insight: ${pattern.title}`,
        summary,
        structuredContent: {
          mainObservation: observation,
          implications: [
            "Pode informar reflexão ou coleta de mais dados",
            "Não autoriza execução automática",
          ],
          confirmationQuestion:
            "Isso corresponde à sua experiência neste contexto?",
          sourcePatternId: pattern.id,
          sourceHypothesisId: relatedHyp?.id ?? null,
          epistemicLevel: "association",
        },
        evidence: pattern.evidence,
        counterEvidence: pattern.counterEvidence,
        assumptions: [
          { statement: "Contexto carregado é relevante", required: true },
        ],
        alternativeHypotheses:
          relatedHyp?.alternativeHypotheses ??
          [
            {
              statement: "A associação é coincidência na amostra",
              confidence: 40,
              rationale: "Amostra limitada",
            },
            {
              statement: "Um fator não observado explica o padrão",
              confidence: 45,
              rationale: "Variáveis omitidas",
            },
          ],
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(pattern.evidence),
        suppressionKey: `insight:${pattern.suppressionKey}`,
        limitations: [
          ...pattern.limitations,
          "Insight não é fato de Identity/Memory/World Model",
          "Correlação não implica causalidade",
        ],
        timeRange: pattern.timeRange,
        insightConfidence: conf,
        patternConfidence: pattern.confidence,
        evidenceConfidence: pattern.evidenceConfidence,
        missionReferences: pattern.missionReferences,
        subjectReferences: pattern.subjectReferences,
      })
    );
  }

  return out.slice(0, max);
}
