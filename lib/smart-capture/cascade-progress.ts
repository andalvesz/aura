/**
 * Cascade progress helpers for visual feedback after Smart Capture.
 */

import {
  CASCADE_STEPS,
  type CascadeProgressStep,
  type CascadeStepId,
} from "@/lib/smart-capture/types";
import type { CascadeReport } from "@/lib/daily/types";

export function initialCascadeProgress(): CascadeProgressStep[] {
  return CASCADE_STEPS.map((s) => ({ ...s, status: "pending" as const }));
}

export function markCascadeStep(
  steps: CascadeProgressStep[],
  id: CascadeStepId,
  status: CascadeProgressStep["status"],
  error?: string
): CascadeProgressStep[] {
  return steps.map((s) =>
    s.id === id ? { ...s, status, error } : s
  );
}

export function cascadeProgressFromReport(
  report: CascadeReport
): CascadeProgressStep[] {
  let steps = initialCascadeProgress();
  steps = markCascadeStep(steps, "memory", "done");
  steps = markCascadeStep(
    steps,
    "promotion",
    report.promotionOk ? "done" : "error",
    report.errors.find((e) => e.startsWith("promotion:"))
  );
  steps = markCascadeStep(
    steps,
    "world",
    report.worldOk ? "done" : "error",
    report.errors.find((e) => e.startsWith("world:"))
  );
  steps = markCascadeStep(
    steps,
    "cognitive",
    report.cognitiveOk ? "done" : "error",
    report.errors.find((e) => e.startsWith("cognitive:"))
  );
  steps = markCascadeStep(
    steps,
    "discovery",
    report.discoveryOk ? "done" : "error",
    report.errors.find((e) => e.startsWith("discovery:"))
  );
  return steps;
}

export function cascadeStepOrder(): CascadeStepId[] {
  return ["memory", "promotion", "world", "cognitive", "discovery"];
}
