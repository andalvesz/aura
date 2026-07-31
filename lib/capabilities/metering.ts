/**
 * Usage metering foundation — aggregate, minimized, no prices, no commercial blocks.
 */

import { newId, nowIso, type PlatformState } from "@/lib/capabilities/store";
import type { UsageEvent, UsageMetricKind } from "@/lib/capabilities/types";

const ALLOWED_META_KEYS = ["source", "route", "capabilityId", "skillId", "count"];

export function recordUsageEventPure(
  state: PlatformState,
  input: {
    kind: UsageMetricKind;
    userId: string | null;
    workspaceId: string | null;
    value?: number;
    metadata?: Record<string, unknown>;
  }
): PlatformState {
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    if (ALLOWED_META_KEYS.includes(k)) meta[k] = v;
  }
  const event: UsageEvent = {
    id: newId("usage"),
    kind: input.kind,
    userId: input.userId,
    workspaceId: input.workspaceId,
    value: input.value ?? 1,
    metadata: meta,
    occurredAt: nowIso(),
  };
  return { ...state, usageEvents: [...state.usageEvents, event] };
}

export function aggregateUsage(
  state: PlatformState,
  opts?: { workspaceId?: string | null; userId?: string | null }
): Record<UsageMetricKind, number> {
  const kinds: UsageMetricKind[] = [
    "active_users",
    "workspaces",
    "storage_bytes",
    "documents_processed",
    "automation_executions",
    "agent_sessions",
    "provider_calls",
    "messages",
    "projects",
    "skills_installed",
  ];
  const out = Object.fromEntries(kinds.map((k) => [k, 0])) as Record<
    UsageMetricKind,
    number
  >;
  for (const e of state.usageEvents) {
    if (opts?.workspaceId != null && e.workspaceId !== opts.workspaceId) continue;
    if (opts?.userId != null && e.userId !== opts.userId) continue;
    out[e.kind] += e.value;
  }
  // Derived skills_installed from installations if no events
  if (out.skills_installed === 0) {
    out.skills_installed = state.skillInstallations.filter(
      (i) =>
        !i.softDeleted &&
        (opts?.userId == null || i.userId === opts.userId) &&
        (opts?.workspaceId == null || i.workspaceId === opts.workspaceId)
    ).length;
  }
  return out;
}
