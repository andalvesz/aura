/**
 * Contradiction detection — show both conflicting recommendations,
 * explain conflict, never auto-choose.
 */

import type {
  RecommendationCard,
  RecommendationConflict,
  RecommendationEngineCandidate,
} from "@/lib/recommendation/types/types";

const CONFLICT_PAIRS: Array<[string, string]> = [
  ["OPPORTUNITY", "RISK"],
  ["PROJECT", "RISK"],
  ["RELATIONSHIP", "PROJECT"],
];

function sharesSource(
  a: RecommendationEngineCandidate | RecommendationCard,
  b: RecommendationEngineCandidate | RecommendationCard
): string[] {
  const idsA = new Set(
    [
      a.relatedDiscovery,
      a.relatedProject,
      a.relatedDecision,
      a.relatedScenario,
      a.relatedPriority,
      ...a.relatedEntityIds,
      ...a.relatedDocumentIds,
      ...a.evidence.map((e) => e.sourceId),
    ].filter(Boolean) as string[]
  );
  const idsB = [
    b.relatedDiscovery,
    b.relatedProject,
    b.relatedDecision,
    b.relatedScenario,
    b.relatedPriority,
    ...b.relatedEntityIds,
    ...b.relatedDocumentIds,
    ...b.evidence.map((e) => e.sourceId),
  ].filter(Boolean) as string[];
  return idsB.filter((id) => idsA.has(id));
}

function typesConflict(a: string, b: string): boolean {
  return CONFLICT_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

/**
 * Annotate candidates with conflicts. Both sides keep the conflict;
 * neither is dropped or auto-chosen.
 */
export function annotateRecommendationConflicts<
  T extends RecommendationEngineCandidate | RecommendationCard,
>(items: T[]): T[] {
  const conflictsByIndex = new Map<number, RecommendationConflict[]>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!typesConflict(a.recommendationType, b.recommendationType)) continue;
      const shared = sharesSource(a, b);
      if (!shared.length) continue;

      const summary = `Conflito entre ${a.recommendationType} ("${a.title}") e ${b.recommendationType} ("${b.title}") — ambas mantidas; escolha humana.`;

      const listA = conflictsByIndex.get(i) ?? [];
      listA.push({
        conflictingRecommendationId: ("id" in b && b.id) || b.fingerprint,
        conflictingTitle: b.title,
        conflictSummary: summary,
        sharedSourceIds: shared,
      });
      conflictsByIndex.set(i, listA);

      const listB = conflictsByIndex.get(j) ?? [];
      listB.push({
        conflictingRecommendationId: ("id" in a && a.id) || a.fingerprint,
        conflictingTitle: a.title,
        conflictSummary: summary,
        sharedSourceIds: shared,
      });
      conflictsByIndex.set(j, listB);
    }
  }

  return items.map((item, index) => ({
    ...item,
    conflicts: [
      ...(item.conflicts ?? []),
      ...(conflictsByIndex.get(index) ?? []),
    ],
  }));
}
