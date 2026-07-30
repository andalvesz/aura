/**
 * Automation engine types.
 */

import type { AutonomyLevel, AuraBrainContextMode } from "@/lib/aura-brain/types";

export type AutomationTrigger =
  | "INTELLIGENCE_GENERATED"
  | "DATA_CHANGED"
  | "DAILY_REVIEW"
  | "MANUAL_RUN";

export type AuraBrainAutomation = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: Record<string, unknown>;
  actionId: string;
  autonomyRequirement: AutonomyLevel;
  cooldownMs: number;
  maxExecutionsPerDay: number;
  enabled: boolean;
  context: AuraBrainContextMode | "any";
  auditMetadata: Record<string, string>;
};

export type AutomationRunState = {
  lastRunAt: Record<string, number>;
  dailyCounts: Record<string, { day: string; count: number }>;
  notifiedKeys: Set<string>;
};
