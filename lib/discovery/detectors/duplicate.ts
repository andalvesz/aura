/**
 * Duplicate detector — similar titles across memories / entities / missions.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export const duplicateDetector: DiscoveryDetector = {
  id: "duplicate_v1",
  type: "DUPLICATE",
  label: "Duplicações",
  description: "Detecta possíveis duplicatas entre memórias, entidades e missões.",
  detect(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const items: Array<{
      id: string;
      title: string;
      layer: "memory" | "world_model" | "mission";
      type: string;
      confidence: number;
    }> = [
      ...context.memories.map((m) => ({
        id: m.id,
        title: m.title,
        layer: "memory" as const,
        type: m.memoryType,
        confidence: m.confidence,
      })),
      ...context.worldEntities.map((e) => ({
        id: e.id,
        title: e.displayName,
        layer: "world_model" as const,
        type: e.entityType,
        confidence: e.confidence,
      })),
      ...context.missions.map((m) => ({
        id: m.id,
        title: m.title,
        layer: "mission" as const,
        type: m.type,
        confidence: 50,
      })),
    ];

    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (out.length >= max) return out;
        const a = items[i]!;
        const b = items[j]!;
        if (a.id === b.id) continue;
        const score = jaccard(tokenSet(a.title), tokenSet(b.title));
        if (score < 0.4) continue;
        const pairKey = [a.id, b.id].sort().join(":");
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        out.push(
          buildCandidate({
            userId: options.userId,
            workspaceId: options.workspaceId,
            type: "DUPLICATE",
            detectorId: "duplicate_v1",
            title: `Possível duplicata: “${a.title}” ≈ “${b.title}”`,
            summary: `Similaridade ${(score * 100).toFixed(0)}% entre itens de ${a.layer} e ${b.layer}.`,
            explanation:
              "Títulos semanticamente próximos sugerem duplicação ou necessidade de consolidação.",
            evidence: [
              makeEvidence({
                evidenceType: "duplicate_candidate_a",
                sourceLayer: a.layer,
                sourceType: a.type,
                sourceId: a.id,
                summary: a.title,
                confidence: a.confidence,
              }),
              makeEvidence({
                evidenceType: "duplicate_candidate_b",
                sourceLayer: b.layer,
                sourceType: b.type,
                sourceId: b.id,
                summary: b.title,
                confidence: b.confidence,
              }),
            ],
            relatedMemories:
              a.layer === "memory" || b.layer === "memory"
                ? [
                    ...(a.layer === "memory"
                      ? [{ entityType: "memory", entityId: a.id }]
                      : []),
                    ...(b.layer === "memory"
                      ? [{ entityType: "memory", entityId: b.id }]
                      : []),
                  ]
                : [],
            relatedEntities:
              a.layer === "world_model" || b.layer === "world_model"
                ? [
                    ...(a.layer === "world_model"
                      ? [{ entityType: "world_entity", entityId: a.id }]
                      : []),
                    ...(b.layer === "world_model"
                      ? [{ entityType: "world_entity", entityId: b.id }]
                      : []),
                  ]
                : [],
            impact: "LOW",
            urgency: "LOW",
            baseConfidence: Math.round(40 + score * 40),
            suppressionParts: ["duplicate", pairKey],
            alternativeInterpretations: [
              "Podem ser itens relacionados, não duplicatas",
              "Pode ser reutilização intencional de nomenclatura",
            ],
          })
        );
      }
    }

    return out.slice(0, max);
  },
};
