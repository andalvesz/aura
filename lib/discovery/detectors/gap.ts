/**
 * Gap detector — missing layers / INSUFFICIENT_EVIDENCE / data completeness.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const gapDetector: DiscoveryDetector = {
  id: "gap_v1",
  type: "GAP",
  label: "Lacunas",
  description: "Detecta lacunas de dados e evidência insuficiente.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    for (const gap of context.dataCompleteness.gaps.slice(0, max)) {
      const labels: Record<string, string> = {
        no_memories: "Nenhuma memória registrada",
        no_world_entities: "World Model sem entidades",
        no_cognitive_artifacts: "Sem artefatos cognitivos",
        no_missions: "Nenhuma missão no contexto",
      };
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "GAP",
          detectorId: "gap_v1",
          title: `Lacuna: ${labels[gap] ?? gap}`,
          summary: `Completeness score ${context.dataCompleteness.score}/100 — ${labels[gap] ?? gap}.`,
          explanation:
            "O contexto cognitivo está incompleto nesta dimensão; Discovery apenas sinaliza a lacuna.",
          evidence: [
            makeEvidence({
              evidenceType: "data_completeness",
              sourceLayer: "discovery",
              sourceType: "completeness",
              sourceId: gap,
              summary: labels[gap] ?? gap,
              confidence: 70,
            }),
          ],
          impact: "MEDIUM",
          urgency: "LOW",
          baseConfidence: 60,
          suppressionParts: ["gap", gap],
          limitations: [
            "Lacuna de cobertura, não falha de usuário",
            "Pode ser intencional (dados ainda não coletados)",
          ],
        })
      );
    }

    const insufficient = context.cognitiveArtifacts.filter(
      (a) =>
        a.artifactType === "INSUFFICIENT_EVIDENCE" ||
        a.artifactType === "DATA_QUALITY_WARNING"
    );
    for (const art of insufficient.slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "GAP",
          detectorId: "gap_v1",
          title: `Lacuna: ${art.title}`,
          summary: art.summary || "Evidência insuficiente no kernel cognitivo.",
          explanation:
            "Artefato cognitivo indica falta de evidência para conclusões mais fortes.",
          evidence: [
            makeEvidence({
              evidenceType: "insufficient_evidence",
              sourceLayer: "cognitive",
              sourceType: art.artifactType,
              sourceId: art.id,
              summary: art.summary || art.title,
              confidence: art.confidence,
            }),
          ],
          relatedArtifacts: [
            { entityType: "cognitive_artifact", entityId: art.id },
          ],
          impact: "LOW",
          urgency: "LOW",
          baseConfidence: Math.min(70, art.confidence + 10),
          suppressionParts: ["gap", "insufficient", art.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
