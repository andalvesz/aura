/**
 * Build structured alerts from FAIL / WARNING rule results.
 * Never returns ready-made chat prose — only objects.
 */

import type {
  IntelligenceAlert,
  IntelligencePriorityLevel,
  RuleResult,
} from "@/lib/intelligence/types";

const LEVEL_RANK: Record<IntelligencePriorityLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function buildAlerts(ruleResults: RuleResult[]): IntelligenceAlert[] {
  const alerts: IntelligenceAlert[] = [];

  for (const r of ruleResults) {
    if (r.status === "PASS") continue;
    // Alerts focus on FAIL + HIGH/CRITICAL WARNING
    if (r.status === "WARNING" && (r.severity === "LOW" || r.severity === "MEDIUM")) {
      continue;
    }
    alerts.push({
      id: `alert-${r.ruleId}-${alerts.length}`,
      type: r.ruleId,
      severity: r.severity,
      module: r.module,
      title: r.title,
      description: r.description,
      action: r.action ?? null,
      target: r.target ?? null,
      sourceRule: r.ruleId,
    });
  }

  return alerts
    .sort((a, b) => LEVEL_RANK[a.severity] - LEVEL_RANK[b.severity])
    .filter((item, index, arr) => {
      return (
        arr.findIndex(
          (x) =>
            x.type === item.type &&
            x.title === item.title &&
            x.module === item.module
        ) === index
      );
    });
}
