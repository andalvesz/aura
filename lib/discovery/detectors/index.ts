/**
 * Detector barrel — individual detectors + registry ensure helper.
 */

export { opportunityDetector } from "@/lib/discovery/detectors/opportunity";
export { riskDetector } from "@/lib/discovery/detectors/risk";
export { gapDetector } from "@/lib/discovery/detectors/gap";
export { dependencyDetector } from "@/lib/discovery/detectors/dependency";
export { stagnationDetector } from "@/lib/discovery/detectors/stagnation";
export { duplicateDetector } from "@/lib/discovery/detectors/duplicate";
export { unknownDetector } from "@/lib/discovery/detectors/unknown";
/** Prefer importing from `@/lib/discovery/registry` — kept for service compat. */
export { ensureBuiltinDiscoveryDetectors } from "@/lib/discovery/registry";
