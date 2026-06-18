import type { AutoImproveAssetType, ImprovementCycle, ImprovementCycleAction } from "@/types/database";
import type { ExcellenceReviewStatus } from "@/utils/specialist-engine";
import {
  EXCELLENCE_APPROVE_THRESHOLD,
  EXCELLENCE_REGENERATE_THRESHOLD,
} from "@/utils/aura-excellence";

export const AUTO_IMPROVE_MAX_CYCLES = 3;

export const AUTO_IMPROVE_ASSET_TYPES: AutoImproveAssetType[] = [
  "copy",
  "landing",
  "creative",
  "offer",
  "funnel",
];

export type AutoImproveOutcome = "approved" | "blocked" | "max_cycles";

export type AutoImproveResult = {
  assetType: AutoImproveAssetType;
  assetId: string;
  finalScore: number;
  status: ExcellenceReviewStatus;
  outcome: AutoImproveOutcome;
  deliverable: boolean;
  cycles: ImprovementCycle[];
  cyclesUsed: number;
};

export function isAutoImproveAssetType(value: string): value is AutoImproveAssetType {
  return AUTO_IMPROVE_ASSET_TYPES.includes(value as AutoImproveAssetType);
}

export function resolveAutoImproveAction(finalScore: number): ImprovementCycleAction {
  if (finalScore >= EXCELLENCE_APPROVE_THRESHOLD) return "approve";
  if (finalScore < EXCELLENCE_REGENERATE_THRESHOLD) return "block";
  return "improve";
}

export function shouldAutoImprove(finalScore: number): boolean {
  return (
    finalScore >= EXCELLENCE_REGENERATE_THRESHOLD &&
    finalScore < EXCELLENCE_APPROVE_THRESHOLD
  );
}

export function resolveCycleStatus(
  action: ImprovementCycleAction,
  finalScore: number
): ImprovementCycle["status"] {
  if (action === "approve") return "approved";
  if (action === "block") return "blocked";
  if (action === "improve") return "improved";
  if (finalScore >= EXCELLENCE_APPROVE_THRESHOLD) return "approved";
  if (finalScore < EXCELLENCE_REGENERATE_THRESHOLD) return "blocked";
  return "running";
}
