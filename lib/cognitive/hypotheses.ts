/**
 * Hypothesis Engine V1 — testable hypotheses with falsification criteria.
 */

import {
  calculateHypothesisConfidence,
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

export function generateHypotheses(
  context: CognitiveContext,
  patterns: CognitiveArtifact[],
  conflicts: CognitiveArtifact[],
  options?: { userId?: string; workspaceId?: string | null; max?: number }
): CognitiveArtifact[] {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const max = options?.max ?? 6;
  const out: CognitiveArtifact[] = [];

  for (const pattern of patterns.filter((p) => p.artifactType === "PATTERN")) {
    const alternatives = [
      {
        statement: "O padrão reflete importância relativa dos itens, não o mecanismo observado",
        confidence: 45,
        rationale: "Seleção enviesada possível",
      },
      {
        statement: "A janela temporal é curta demais para generalizar",
        confidence: 40,
        rationale: "Escopo temporal limitado",
      },
      {
        statement: "Itens observados já estavam bem encaminhados",
        confidence: 35,
        rationale: "Confusão com estado prévio",
      },
    ];

    const statement = `${calibratedLanguage(pattern.confidenceBand)} que o padrão "${pattern.title}" se mantenha se a amostra crescer no mesmo contexto.`;
    const conf = calculateHypothesisConfidence({
      supporting: pattern.evidence,
      counter: pattern.counterEvidence,
      assumptionCount: 2,
      alternativeCount: alternatives.length,
    });

    const fp = fingerprint([
      "hypothesis",
      pattern.fingerprint,
      METHOD_VERSION,
    ]);

    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "HYPOTHESIS",
        category: String(pattern.structuredContent.patternKind ?? "pattern"),
        title: `Hipótese a partir de: ${pattern.title}`,
        summary: statement,
        structuredContent: {
          statement,
          expectedObservations: [
            "Repetição do padrão em nova amostra independente",
            "Estabilidade do percentual/frequência sob mesma janela relativa",
          ],
          falsificationCriteria: [
            "Nova amostra independente não reproduz o padrão",
            "Correção humana rejeita a interpretação",
            "Mudança de contexto elimina a associação",
          ],
          reviewStatus: "PENDING_REVIEW",
          sourcePatternId: pattern.id,
        },
        evidence: pattern.evidence,
        counterEvidence: pattern.counterEvidence,
        assumptions: [
          { statement: "O contexto carregado é representativo", required: true },
          { statement: "Registros rejeitados foram excluídos", required: true },
        ],
        alternativeHypotheses: alternatives,
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(pattern.evidence),
        suppressionKey: `hypothesis:${pattern.suppressionKey}`,
        limitations: [
          "Hipótese testável — não fato",
          "Sem inferência clínica ou psicológica",
        ],
        timeRange: pattern.timeRange,
        hypothesisConfidence: conf,
        evidenceConfidence: pattern.evidenceConfidence,
        subjectReferences: pattern.subjectReferences,
        missionReferences: pattern.missionReferences,
      })
    );
  }

  for (const conflict of conflicts.slice(0, 2)) {
    if (conflict.structuredContent.nature === "contextual_difference") continue;
    const statement =
      "As fontes em conflito podem refletir mudança temporal em vez de erro simultâneo.";
    const conf = calculateHypothesisConfidence({
      supporting: conflict.evidence,
      counter: conflict.counterEvidence,
      assumptionCount: 1,
      alternativeCount: conflict.alternativeHypotheses.length,
    });
    const fp = fingerprint(["hypothesis", "conflict", conflict.fingerprint]);
    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "HYPOTHESIS",
        category: "temporal_change",
        title: "Hipótese de mudança temporal",
        summary: statement,
        structuredContent: {
          statement,
          expectedObservations: [
            "A claim mais recente prevalece após confirmação humana",
          ],
          falsificationCriteria: [
            "Usuário confirma que ambos os valores são simultaneamente válidos no mesmo contexto",
          ],
          reviewStatus: "PENDING_REVIEW",
          sourceConflictId: conflict.id,
        },
        evidence: conflict.evidence,
        counterEvidence: conflict.counterEvidence,
        assumptions: [
          { statement: "Timestamps das fontes são confiáveis", required: false },
        ],
        alternativeHypotheses: conflict.alternativeHypotheses,
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(conflict.evidence),
        suppressionKey: `hypothesis:conflict:${conflict.id}`,
        limitations: ["Não resolve o conflito automaticamente"],
        timeRange: context.temporalContext,
        hypothesisConfidence: conf,
      })
    );
  }

  return out.slice(0, max);
}
