import type { PlanSourceSlice } from "@/lib/planner/types/types";
import { emptyPlanSources } from "@/lib/planner/context/context";

export type PlanProviderBundle = Partial<PlanSourceSlice>;

export function collectPlanSources(
  bundle: PlanProviderBundle = {}
): PlanSourceSlice {
  const base = emptyPlanSources();
  return { ...base, ...bundle };
}

export const PLAN_PROVIDER_LAYERS = [
  "identity",
  "memory",
  "world",
  "cognitive",
  "discovery",
  "knowledge",
  "projects",
  "business",
  "decision",
  "scenario",
  "prioritization",
  "recommendation",
  "mission",
] as const;
