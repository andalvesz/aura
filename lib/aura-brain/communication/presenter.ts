/**
 * Present structured Aura Brain activity for UI — never only free text.
 */

import type {
  AuraBrainRunResult,
  ExecutableAction,
  ProposedAction,
} from "@/lib/aura-brain/types";

export type AuraBrainActivityItem = {
  id: string;
  kind:
    | "suggested"
    | "prepared"
    | "awaiting_confirmation"
    | "executed"
    | "failed";
  title: string;
  detail: string;
  actionId: string | null;
};

export function presentAuraBrainActivity(
  result: AuraBrainRunResult
): AuraBrainActivityItem[] {
  const items: AuraBrainActivityItem[] = [];

  for (const p of result.proposedActions.slice(0, 8)) {
    items.push({
      id: p.id,
      kind: mapStatus(p),
      title: p.title,
      detail: p.reason,
      actionId: p.actionId,
    });
  }

  for (const a of result.auditEntries.slice(0, 8)) {
    if (a.status === "executed" || a.status === "failed") {
      items.push({
        id: a.id,
        kind: a.status === "executed" ? "executed" : "failed",
        title: a.actionId ?? a.source,
        detail: a.error ?? a.source,
        actionId: a.actionId,
      });
    }
  }

  return items.slice(0, 12);
}

function mapStatus(
  p: ProposedAction | ExecutableAction
): AuraBrainActivityItem["kind"] {
  if (p.status === "awaiting_confirmation") return "awaiting_confirmation";
  if (p.status === "prepared") return "prepared";
  if (p.status === "executed") return "executed";
  if (p.status === "failed") return "failed";
  return "suggested";
}

export type { AuraBrainActivityItem as PresentedActivity };
