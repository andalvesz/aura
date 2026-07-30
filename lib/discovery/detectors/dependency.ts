/**
 * Dependency detector — world relationships and mission coupling.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const dependencyDetector: DiscoveryDetector = {
  id: "dependency_v1",
  type: "DEPENDENCY",
  label: "Dependências",
  description: "Detecta dependências entre entidades e missões.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const deps = context.worldRelationships.filter((r) =>
      /depend|block|require|enable|support|parent|child/i.test(r.relationshipType)
    );

    const pool =
      deps.length > 0
        ? deps
        : context.worldRelationships.filter((r) => r.confidence >= 50);

    for (const rel of pool.slice(0, max)) {
      const source =
        context.worldEntities.find((e) => e.id === rel.sourceEntityId)?.displayName ??
        rel.sourceEntityId.slice(0, 8);
      const target =
        context.worldEntities.find((e) => e.id === rel.targetEntityId)?.displayName ??
        rel.targetEntityId.slice(0, 8);

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "DEPENDENCY",
          detectorId: "dependency_v1",
          title: `Dependência: ${source} → ${target}`,
          summary: `Relação “${rel.relationshipType}” entre ${source} e ${target}.`,
          explanation:
            "World Model indica acoplamento entre entidades que pode afetar progresso.",
          evidence: [
            makeEvidence({
              evidenceType: "world_relationship",
              sourceLayer: "world_model",
              sourceType: rel.relationshipType,
              sourceId: rel.id,
              summary: `${source} [${rel.relationshipType}] ${target}`,
              confidence: rel.confidence,
            }),
          ],
          relatedEntities: [
            { entityType: "world_entity", entityId: rel.sourceEntityId },
            { entityType: "world_entity", entityId: rel.targetEntityId },
          ],
          impact: "MEDIUM",
          urgency: "LOW",
          baseConfidence: Math.min(75, rel.confidence + 5),
          suppressionParts: [
            "dependency",
            rel.relationshipType,
            rel.sourceEntityId,
            rel.targetEntityId,
          ],
        })
      );
    }

    // Multiple active missions sharing similar titles → soft dependency signal
    const active = context.missions.filter((m) => m.status === "ACTIVE");
    if (active.length >= 2 && out.length < max) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "DEPENDENCY",
          detectorId: "dependency_v1",
          title: "Dependência: múltiplas missões ativas",
          summary: `${active.length} missões ativas podem competir por atenção e recursos.`,
          explanation:
            "Várias missões simultâneas aumentam dependência de priorização explícita.",
          evidence: active.slice(0, 3).map((m) =>
            makeEvidence({
              evidenceType: "active_mission",
              sourceLayer: "mission",
              sourceType: "mission",
              sourceId: m.id,
              summary: m.title,
              confidence: 50,
            })
          ),
          impact: "MEDIUM",
          urgency: "MEDIUM",
          baseConfidence: 48,
          suppressionParts: ["dependency", "multi_mission", String(active.length)],
        })
      );
    }

    return out.slice(0, max);
  },
};
