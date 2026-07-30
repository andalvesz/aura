/**
 * Planner types.
 */

import type { AuraBrainPlan, ProposedAction } from "@/lib/aura-brain/types";
import type { AuraIntelligenceResult } from "@/lib/intelligence/types";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import type { MissionSuggestedAction } from "@/lib/missions/mission-types";

export type PlannerInput = {
  userId: string;
  context: "personal" | "workspace";
  intelligence: Pick<
    AuraIntelligenceResult,
    "priorities" | "alerts" | "recommendations" | "insights" | "score"
  >;
  settings: AuraBrainSettings;
  pendingDedupeKeys?: string[];
  /** Safe mission suggestions from Mission Engine */
  missionActions?: MissionSuggestedAction[];
};

export type PlannerOutput = {
  plans: AuraBrainPlan[];
  proposedActions: ProposedAction[];
  executionMs: number;
};
