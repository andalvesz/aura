/**
 * Preference helpers for Learning layer.
 */

import type { AutonomyLevel } from "@/lib/aura-brain/types";

export type PreferenceSnapshot = {
  autonomy: AutonomyLevel;
  suppressedTargets: string[];
};
