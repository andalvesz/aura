/**
 * Opportunity detector — recommendation/insight with high actionability cues.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

export const opportunityDetector: DiscoveryDetector = {
  id: "opportunity_v1",
  type: "OPPORTUNITY",
  label: "Oportunidades",
  description:
    "Detecta oportunidades a partir de insights e recomendações cognitivas.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const recs = context.cognitiveArtifacts.filter(
      (a) =>
        (a.artifactType === "RECOMMENDATION" || a.artifactType === "INSIGHT") &&
        a.confidence >= 45 &&
        !["REJECTED", "DELETED", "ARCHIVED"].includes(a.status)
    );

    for (const art of recs.slice(0, max)) {
      const evidence = [
        makeEvidence({
          evidenceType: "cognitive_artifact",
          sourceLayer: "cognitive",
          sourceType: art.artifactType,
          sourceId: art.id,
          summary: art.summary || art.title,
          confidence: art.confidence,
        }),
      ];
      const relatedMem = context.memories.slice(0, 2).map((m) =>
        makeEvidence({
          evidenceType: "related_memory",
          sourceLayer: "memory",
          sourceType: m.memoryType,
          sourceId: m.id,
          summary: m.title,
          confidence: m.confidence,
        })
      );
      evidence.push(...relatedMem);

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "OPPORTUNITY",
          detectorId: "opportunity_v1",
          title: `Oportunidade: ${art.title}`,
          summary: art.summary || "Sinal de oportunidade a partir do raciocínio cognitivo.",
          explanation:
            "Artefato cognitivo com confiança suficiente sugere uma direção útil para exploração (sem execução).",
          evidence,
          relatedArtifacts: [
            { entityType: "cognitive_artifact", entityId: art.id },
          ],
          relatedInsights:
            art.artifactType === "INSIGHT"
              ? [{ entityType: "cognitive_artifact", entityId: art.id }]
              : [],
          relatedMemories: (context.memories ?? []).slice(0, 2).map((m) => ({
            entityType: "memory",
            entityId: m.id,
          })),
          relatedEntities: (context.worldEntities ?? []).slice(0, 2).map((e) => ({
            entityType: e.entityType,
            entityId: e.id,
          })),
          impact: art.confidence >= 70 ? "HIGH" : "MEDIUM",
          urgency: "MEDIUM",
          baseConfidence: Math.min(78, art.confidence + 5),
          suppressionParts: ["opportunity", art.category || "general", art.title],
          alternativeInterpretations: [
            "Pode ser apenas reforço de um padrão já conhecido",
            "Pode não valer a pena agora dado o contexto atual",
          ],
        })
      );
    }

    // Mission gap opportunity: active goals without related missions
    if (
      out.length < max &&
      context.memories.some((m) => /meta|objetivo|quero|planej/i.test(m.title)) &&
      context.missions.filter((m) => m.status === "ACTIVE").length === 0
    ) {
      const mem = context.memories.find((m) =>
        /meta|objetivo|quero|planej/i.test(m.title)
      )!;
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          type: "OPPORTUNITY",
          detectorId: "opportunity_v1",
          title: "Oportunidade: transformar intenção em missão",
          summary: `Há memória de intenção (“${mem.title}”) sem missão ativa correspondente.`,
          explanation:
            "Memórias de intenção sem missão sugerem oportunidade de estruturar progresso — Discovery não cria a missão.",
          evidence: [
            makeEvidence({
              evidenceType: "intention_memory",
              sourceLayer: "memory",
              sourceType: mem.memoryType,
              sourceId: mem.id,
              summary: mem.title,
              confidence: mem.confidence,
            }),
          ],
          relatedMemories: [{ entityType: "memory", entityId: mem.id }],
          impact: "MEDIUM",
          urgency: "LOW",
          baseConfidence: 52,
          suppressionParts: ["opportunity", "intention_to_mission", mem.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
