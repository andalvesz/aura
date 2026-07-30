/**
 * Stagnation detector — abandoned patterns / stalled progress.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const stagnationDetector: DiscoveryDetector = {
  id: "stagnation_v1",
  type: "STAGNATION",
  label: "Estagnação",
  description: "Detecta estagnação em progresso e padrões de abandono.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const progress = context.cognitiveArtifacts.filter(
      (a) =>
        a.artifactType === "PROGRESS_OBSERVATION" ||
        a.artifactType === "PATTERN"
    );

    for (const art of progress) {
      const abandonment =
        /abandon|estagn|parad|sem progresso|stagn|inativ/i.test(
          `${art.title} ${art.summary}`
        );
      if (!abandonment && art.artifactType !== "PROGRESS_OBSERVATION") continue;

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "STAGNATION",
          detectorId: "stagnation_v1",
          title: `Estagnação: ${art.title}`,
          summary: art.summary || "Sinal de estagnação no progresso observado.",
          explanation:
            "Padrão ou observação de progresso indica possível estagnação.",
          evidence: [
            makeEvidence({
              evidenceType: "progress_signal",
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
          impact: "MEDIUM",
          urgency: "MEDIUM",
          baseConfidence: Math.min(72, art.confidence),
          suppressionParts: ["stagnation", art.id, art.title],
        })
      );
      if (out.length >= max) break;
    }

    const lowMissions = context.missions.filter(
      (m) =>
        ["ACTIVE", "PAUSED"].includes(m.status) &&
        (m.progress == null || m.progress < 20)
    );
    for (const m of lowMissions.slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "STAGNATION",
          detectorId: "stagnation_v1",
          title: `Estagnação: ${m.title}`,
          summary: `Missão ${m.status.toLowerCase()} com progresso ${m.progress ?? "indefinido"}.`,
          explanation:
            "Missão com pouco avanço recente sugere estagnação — Discovery não altera a missão.",
          evidence: [
            makeEvidence({
              evidenceType: "mission_stagnation",
              sourceLayer: "mission",
              sourceType: "mission",
              sourceId: m.id,
              summary: m.title,
              confidence: 55,
            }),
          ],
          impact: "MEDIUM",
          urgency: "LOW",
          baseConfidence: 54,
          suppressionParts: ["stagnation", "mission", m.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
