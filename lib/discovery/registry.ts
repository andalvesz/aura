/**
 * Discovery Registry — all detectors registered; no hardcode in engine.
 */

import { dependencyDetector } from "@/lib/discovery/detectors/dependency";
import { duplicateDetector } from "@/lib/discovery/detectors/duplicate";
import { gapDetector } from "@/lib/discovery/detectors/gap";
import { opportunityDetector } from "@/lib/discovery/detectors/opportunity";
import { businessExpertOpportunityDetector } from "@/lib/discovery/detectors/business-expert";
import { riskDetector } from "@/lib/discovery/detectors/risk";
import { stagnationDetector } from "@/lib/discovery/detectors/stagnation";
import { unknownDetector } from "@/lib/discovery/detectors/unknown";
import type {
  DetectorCandidate,
  DiscoveryContext,
  DiscoveryDetector,
  DiscoveryType,
} from "@/lib/discovery/types";

const registry = new Map<string, DiscoveryDetector>();

export function registerDiscoveryDetector(detector: DiscoveryDetector): void {
  registry.set(detector.id, detector);
}

export function unregisterDiscoveryDetector(id: string): void {
  registry.delete(id);
}

export function getDiscoveryDetector(id: string): DiscoveryDetector | undefined {
  return registry.get(id);
}

export function listDiscoveryDetectors(): DiscoveryDetector[] {
  return Array.from(registry.values());
}

export function listDiscoveryDetectorsByType(
  type: DiscoveryType
): DiscoveryDetector[] {
  return listDiscoveryDetectors().filter((d) => d.type === type);
}

export function clearDiscoveryRegistry(): void {
  registry.clear();
}

export function ensureBuiltinDiscoveryDetectors(): void {
  const builtins = [
    opportunityDetector,
    businessExpertOpportunityDetector,
    riskDetector,
    gapDetector,
    dependencyDetector,
    stagnationDetector,
    duplicateDetector,
    unknownDetector,
  ];
  for (const d of builtins) {
    if (!registry.has(d.id)) registerDiscoveryDetector(d);
  }
}

export function runDiscoveryRegistry(
  context: DiscoveryContext,
  options: {
    userId: string;
    workspaceId?: string | null;
    maxPerDetector?: number;
    detectorIds?: string[];
  }
): {
  candidates: DetectorCandidate[];
  detectorsRun: number;
  byDetector: Record<string, number>;
} {
  ensureBuiltinDiscoveryDetectors();
  const detectors = listDiscoveryDetectors().filter((d) =>
    options.detectorIds ? options.detectorIds.includes(d.id) : true
  );

  const candidates: DetectorCandidate[] = [];
  const byDetector: Record<string, number> = {};

  for (const detector of detectors) {
    const found = detector.detect(context, {
      userId: options.userId,
      workspaceId: options.workspaceId ?? null,
      max: options.maxPerDetector ?? 4,
    });
    byDetector[detector.id] = found.length;
    candidates.push(...found);
  }

  return {
    candidates,
    detectorsRun: detectors.length,
    byDetector,
  };
}

export {
  opportunityDetector,
  riskDetector,
  gapDetector,
  dependencyDetector,
  stagnationDetector,
  duplicateDetector,
  unknownDetector,
};
