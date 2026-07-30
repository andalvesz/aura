/**
 * Planner rules — map intelligence signals → action proposals.
 */

import { buildDedupeKey } from "@/lib/aura-brain/planner/deduplication";
import type { ProposedAction } from "@/lib/aura-brain/types";
import type { IntelligencePriority } from "@/lib/intelligence/types";

export function proposalsFromPriorities(
  priorities: IntelligencePriority[],
  pending: Set<string>
): ProposedAction[] {
  const out: ProposedAction[] = [];

  for (const p of priorities) {
    if (p.level === "CRITICAL") {
      const dedupeKey = buildDedupeKey("create_notification", [
        "critical",
        p.id,
        p.module,
      ]);
      if (pending.has(dedupeKey)) continue;
      out.push({
        id: `prop-${dedupeKey}`,
        actionId: "create_notification",
        planId: null,
        title: `Notificar: ${p.title}`,
        reason: p.description,
        riskLevel: "LOW",
        autonomyRequired: "AUTO_SAFE",
        input: {
          title: `Prioridade crítica: ${p.title}`,
          message: p.description,
          type: "aura_brain_critical",
          related_module: p.module,
          related_id: p.id,
        },
        status: "proposed",
        dedupeKey,
      });
    }

    if (p.module === "habitos" && p.sourceRule === "HabitBrokenRule") {
      const habitId = p.id.replace(/^prio-HabitBrokenRule-\d+$/, "") || p.id;
      const dedupeKey = buildDedupeKey("complete_habit", [p.title]);
      if (!pending.has(dedupeKey)) {
        out.push({
          id: `prop-${dedupeKey}`,
          actionId: "complete_habit",
          planId: null,
          title: `Concluir hábito: ${p.title}`,
          reason: p.description,
          riskLevel: "LOW",
          autonomyRequired: "CONFIRM",
          input: { habitId, title: p.title },
          status: "proposed",
          dedupeKey,
        });
      }
    }

    if (p.module === "financeiro") {
      const dedupeKey = buildDedupeKey("create_financial_entry_draft", [
        p.id,
      ]);
      if (!pending.has(dedupeKey)) {
        out.push({
          id: `prop-${dedupeKey}`,
          actionId: "create_financial_entry_draft",
          planId: null,
          title: "Preparar revisão financeira",
          reason: p.description,
          riskLevel: "HIGH",
          autonomyRequired: "CONFIRM",
          input: { title: p.title, reason: p.description },
          status: "proposed",
          dedupeKey,
        });
      }
    }
  }

  return out;
}
