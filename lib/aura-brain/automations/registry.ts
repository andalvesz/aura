/**
 * Built-in automations registry.
 */

import type { AuraBrainAutomation } from "@/lib/aura-brain/automations/types";

const automations = new Map<string, AuraBrainAutomation>();

export function registerAutomation(a: AuraBrainAutomation): void {
  automations.set(a.id, a);
}

export function clearAutomations(): void {
  automations.clear();
}

export function listAutomations(): AuraBrainAutomation[] {
  return [...automations.values()];
}

export function getAutomation(id: string): AuraBrainAutomation | undefined {
  return automations.get(id);
}

export const CRITICAL_PRIORITY_NOTIFICATION: AuraBrainAutomation = {
  id: "notify_critical_priority",
  name: "Notificar prioridade crítica nova",
  trigger: "INTELLIGENCE_GENERATED",
  conditions: { priorityLevel: "CRITICAL" },
  actionId: "create_notification",
  autonomyRequirement: "AUTO_SAFE",
  cooldownMs: 60_000,
  maxExecutionsPerDay: 10,
  enabled: true,
  context: "any",
  auditMetadata: { safety: "internal_notification_only" },
};

/** Mission stalled reminder — LOW risk notification only */
export const MISSION_STALLED_REMINDER: AuraBrainAutomation = {
  id: "notify_mission_stalled",
  name: "Lembrar missão parada",
  trigger: "INTELLIGENCE_GENERATED",
  conditions: {},
  actionId: "create_notification",
  autonomyRequirement: "AUTO_SAFE",
  cooldownMs: 3_600_000,
  maxExecutionsPerDay: 3,
  enabled: true,
  context: "any",
  auditMetadata: { safety: "mission_reminder_low_risk", source: "mission_engine" },
};

let ready = false;

export function ensureBuiltinAutomations(): void {
  if (ready && automations.size > 0) return;
  registerAutomation(CRITICAL_PRIORITY_NOTIFICATION);
  registerAutomation(MISSION_STALLED_REMINDER);
  ready = true;
}
