/**
 * Project-scoped discovery helpers — filter related discoveries.
 * Does not alter Discovery Kernel; only filters public artifacts.
 */

import type { DiscoveryArtifact, DiscoveryType } from "@/lib/discovery/types";

const PROJECT_DISCOVERY_TYPES: DiscoveryType[] = [
  "OPPORTUNITY",
  "RISK",
  "GAP",
  "DEPENDENCY",
  "STAGNATION",
];

export function filterDiscoveriesForProject(
  artifacts: DiscoveryArtifact[],
  projectId: string,
  opts?: {
    memoryIds?: string[];
    entityIds?: string[];
    types?: DiscoveryType[];
  }
): DiscoveryArtifact[] {
  const memoryIds = new Set(opts?.memoryIds ?? []);
  const entityIds = new Set(opts?.entityIds ?? []);
  const types = new Set(opts?.types ?? PROJECT_DISCOVERY_TYPES);

  return artifacts.filter((a) => {
    if (!types.has(a.type)) return false;
    if (a.status === "DELETED" || a.status === "ARCHIVED") return false;

    const related = a.relatedEntities ?? [];
    const hitProject = related.some(
      (r) => r.entityType === "project" && r.entityId === projectId
    );
    if (hitProject) return true;

    if (memoryIds.size) {
      const hitMemory = related.some(
        (r) =>
          (r.entityType === "memory" || r.entityType === "aura_memory") &&
          memoryIds.has(r.entityId)
      );
      if (hitMemory) return true;
    }

    if (entityIds.size) {
      const hitEntity = related.some((r) => entityIds.has(r.entityId));
      if (hitEntity) return true;
    }

    // Soft match: title/summary mentions project id (rare) or project tag in metadata
    const meta = (a as { metadata?: Record<string, unknown> }).metadata;
    if (meta?.projectId === projectId) return true;

    return false;
  });
}

export function groupDiscoveriesByType(
  artifacts: DiscoveryArtifact[]
): Partial<Record<DiscoveryType, DiscoveryArtifact[]>> {
  const out: Partial<Record<DiscoveryType, DiscoveryArtifact[]>> = {};
  for (const a of artifacts) {
    const list = out[a.type] ?? [];
    list.push(a);
    out[a.type] = list;
  }
  return out;
}

export { PROJECT_DISCOVERY_TYPES };
