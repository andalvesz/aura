/**
 * Build structured priorities from rule results.
 */

import type {
  IntelligencePriority,
  IntelligencePriorityLevel,
  RuleResult,
} from "@/lib/intelligence/types";

const LEVEL_RANK: Record<IntelligencePriorityLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function buildPriorities(
  ruleResults: RuleResult[]
): IntelligencePriority[] {
  const items: IntelligencePriority[] = [];

  for (const r of ruleResults) {
    if (r.status === "PASS") continue;
    items.push({
      id: `prio-${r.ruleId}-${items.length}`,
      level: r.severity,
      module: r.module,
      title: r.title,
      description: r.description,
      target: r.target ?? null,
      sourceRule: r.ruleId,
    });
  }

  return items
    .sort((a, b) => {
      const byLevel = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
      if (byLevel !== 0) return byLevel;
      return a.title.localeCompare(b.title, "pt-BR");
    })
    .filter((item, index, arr) => {
      // Deduplicate identical title+module+level
      return (
        arr.findIndex(
          (x) =>
            x.title === item.title &&
            x.module === item.module &&
            x.level === item.level &&
            x.sourceRule === item.sourceRule
        ) === index
      );
    });
}
