/**
 * Risk detector — RISK_SIGNAL / CONFLICT cognitive artifacts + weak missions.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const riskDetector: DiscoveryDetector = {
  id: "risk_v1",
  type: "RISK",
  label: "Riscos",
  description: "Detecta riscos a partir de sinais cognitivos e missões estagnadas.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const risks = context.cognitiveArtifacts.filter(
      (a) =>
        (a.artifactType === "RISK_SIGNAL" || a.artifactType === "CONFLICT") &&
        !["REJECTED", "DELETED", "ARCHIVED"].includes(a.status)
    );

    for (const art of risks.slice(0, max)) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "RISK",
          detectorId: "risk_v1",
          title: `Risco: ${art.title}`,
          summary: art.summary || "Sinal de risco identificado no kernel cognitivo.",
          explanation:
            "Artefato cognitivo de conflito ou risco indica atenção necessária — sem ação automática.",
          evidence: [
            makeEvidence({
              evidenceType: "cognitive_risk",
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
          relatedInsights: [{ entityType: "cognitive_artifact", entityId: art.id }],
          impact: art.confidence >= 65 ? "HIGH" : "MEDIUM",
          urgency: art.confidence >= 65 ? "HIGH" : "MEDIUM",
          baseConfidence: Math.min(82, art.confidence + 8),
          suppressionParts: ["risk", art.artifactType, art.title],
          limitations: [
            "Risco observado, não causa confirmada",
            "Discovery não mitiga nem executa resposta",
          ],
        })
      );
    }

    const stalled = context.missions.filter(
      (m) =>
        m.status === "ACTIVE" &&
        (m.progress == null || m.progress < 15)
    );
    for (const mission of stalled.slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "RISK",
          detectorId: "risk_v1",
          title: `Risco: missão com baixo progresso — ${mission.title}`,
          summary: `Missão ativa “${mission.title}” com progresso baixo ou indefinido.`,
          explanation:
            "Missões ativas sem progresso material elevam risco de abandono.",
          evidence: [
            makeEvidence({
              evidenceType: "mission_progress",
              sourceLayer: "mission",
              sourceType: "mission",
              sourceId: mission.id,
              summary: `${mission.title} · progresso ${mission.progress ?? "n/d"}`,
              confidence: 55,
            }),
          ],
          impact: "MEDIUM",
          urgency: "MEDIUM",
          baseConfidence: 58,
          suppressionParts: ["risk", "low_progress", mission.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
