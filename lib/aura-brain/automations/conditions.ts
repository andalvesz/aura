/**
 * Automation condition helpers.
 */

import type { ProposedAction } from "@/lib/aura-brain/types";

export function isCriticalNotificationProposal(p: ProposedAction): boolean {
  return (
    p.actionId === "create_notification" &&
    p.input.type === "aura_brain_critical"
  );
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
