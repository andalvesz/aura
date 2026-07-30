/**
 * Unknown detector — clarifying questions / low-confidence open items.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const unknownDetector: DiscoveryDetector = {
  id: "unknown_v1",
  type: "UNKNOWN",
  label: "Desconhecido / confirmação",
  description:
    "Detecta áreas que precisam de confirmação humana ou esclarecimento.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const clarifying = context.cognitiveArtifacts.filter(
      (a) =>
        a.artifactType === "CLARIFYING_QUESTION" ||
        (a.confidence > 0 && a.confidence < 40)
    );

    for (const art of clarifying.slice(0, max)) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "UNKNOWN",
          detectorId: "unknown_v1",
          title: `Necessita confirmação: ${art.title}`,
          summary: art.summary || "Item com baixa confiança ou pergunta em aberto.",
          explanation:
            "Há incerteza epistêmica; a confirmação humana melhora o modelo sem execução.",
          evidence: [
            makeEvidence({
              evidenceType: "uncertain_artifact",
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
          urgency: "MEDIUM",
          baseConfidence: Math.max(30, Math.min(50, art.confidence)),
          suppressionParts: ["unknown", art.id],
          limitations: [
            "Não é fato confirmado",
            "Requer revisão humana antes de qualquer uso operacional",
          ],
        })
      );
    }

    const hypMemories = context.memories.filter(
      (m) =>
        m.memoryType === "HYPOTHESIS" ||
        (m.confidence > 0 && m.confidence < 45)
    );
    for (const mem of hypMemories.slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "UNKNOWN",
          detectorId: "unknown_v1",
          title: `Necessita confirmação: ${mem.title}`,
          summary: mem.summary || "Memória com baixa confiança ou hipótese.",
          explanation:
            "Memória hipotética ou pouco confiante merece confirmação explícita.",
          evidence: [
            makeEvidence({
              evidenceType: "uncertain_memory",
              sourceLayer: "memory",
              sourceType: mem.memoryType,
              sourceId: mem.id,
              summary: mem.title,
              confidence: mem.confidence,
            }),
          ],
          relatedMemories: [{ entityType: "memory", entityId: mem.id }],
          impact: "LOW",
          urgency: "LOW",
          baseConfidence: 42,
          suppressionParts: ["unknown", "memory", mem.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
