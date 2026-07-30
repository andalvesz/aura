/**
 * Initial memory providers (minimal, isolated).
 */

import { listRecentAudits } from "@/lib/aura-brain/audit";
import { registerMemoryProvider } from "@/lib/aura-brain/memory/registry";
import type {
  MemoryProvider,
  MemoryRecord,
  MemoryScope,
} from "@/lib/aura-brain/memory/types";
import type { AuraBrainPlan, AuraBrainSettings } from "@/lib/aura-brain/types";

const preferencesStore = new Map<string, AuraBrainSettings>();
const planHistoryStore = new Map<string, AuraBrainPlan[]>();

export function storeUserPreferences(settings: AuraBrainSettings): void {
  preferencesStore.set(settings.userId, settings);
}

export function storePlanHistory(userId: string, plans: AuraBrainPlan[]): void {
  const prev = planHistoryStore.get(userId) ?? [];
  planHistoryStore.set(userId, [...plans, ...prev].slice(0, 50));
}

export const UserPreferenceMemoryProvider: MemoryProvider = {
  id: "user_preferences",
  async list(scope: MemoryScope) {
    const s = preferencesStore.get(scope.userId);
    if (!s) return [];
    return [
      {
        id: `pref-${scope.userId}`,
        kind: "preference",
        title: "Autonomia",
        content: s.defaultAutonomyLevel,
        createdAt: s.updatedAt,
        meta: { userId: scope.userId },
      } satisfies MemoryRecord,
    ];
  },
};

export const PlanHistoryMemoryProvider: MemoryProvider = {
  id: "plan_history",
  async list(scope: MemoryScope, limit = 10) {
    return (planHistoryStore.get(scope.userId) ?? []).slice(0, limit).map((p) => ({
      id: p.id,
      kind: "plan",
      title: p.title,
      content: p.objective,
      createdAt: p.createdAt,
      meta: { userId: scope.userId, context: p.context },
    }));
  },
};

export const ActionHistoryMemoryProvider: MemoryProvider = {
  id: "action_history",
  async list(scope: MemoryScope, limit = 10) {
    return listRecentAudits(scope.userId, limit).map((a) => ({
      id: a.id,
      kind: "action_audit",
      title: a.actionId ?? a.source,
      content: a.status,
      createdAt: a.createdAt,
      meta: {
        userId: a.userId,
        workspaceId: a.workspaceId,
      },
    }));
  },
};

let memoryReady = false;

export function registerDefaultMemoryProviders(): void {
  if (memoryReady) return;
  registerMemoryProvider(UserPreferenceMemoryProvider);
  registerMemoryProvider(PlanHistoryMemoryProvider);
  registerMemoryProvider(ActionHistoryMemoryProvider);
  memoryReady = true;
}
