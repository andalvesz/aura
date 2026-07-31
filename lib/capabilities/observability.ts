/**
 * Platform observability — minimized events, no private content / secrets.
 */

import { newId, nowIso, sanitizeAuditMeta, type PlatformState } from "@/lib/capabilities/store";

export type PlatformObsEvent =
  | "signup_started"
  | "signup_completed"
  | "email_confirmed"
  | "login_succeeded"
  | "login_failed"
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "workspace_created"
  | "invite_created"
  | "invite_accepted"
  | "capability_installed"
  | "skill_installed"
  | "feature_flag_resolved"
  | "home_loaded"
  | "platform_error";

export type ObservabilityRecord = {
  id: string;
  event: PlatformObsEvent;
  userId: string | null;
  workspaceId: string | null;
  correlationId: string;
  durationMs: number | null;
  result: string;
  errorCode: string | null;
  environment: string;
  module: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __AURA_PLATFORM_OBS__: ObservabilityRecord[] | undefined;
}

function buffer(): ObservabilityRecord[] {
  if (!globalThis.__AURA_PLATFORM_OBS__) {
    globalThis.__AURA_PLATFORM_OBS__ = [];
  }
  return globalThis.__AURA_PLATFORM_OBS__;
}

export function clearPlatformObservability(): void {
  globalThis.__AURA_PLATFORM_OBS__ = [];
}

export function recordPlatformEvent(input: {
  event: PlatformObsEvent;
  userId?: string | null;
  workspaceId?: string | null;
  correlationId?: string;
  durationMs?: number | null;
  result?: string;
  errorCode?: string | null;
  module?: string;
  metadata?: Record<string, unknown>;
}): ObservabilityRecord {
  const row: ObservabilityRecord = {
    id: newId("obs"),
    event: input.event,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    correlationId: input.correlationId ?? newId("corr"),
    durationMs: input.durationMs ?? null,
    result: input.result ?? "ok",
    errorCode: input.errorCode ?? null,
    environment: process.env.NODE_ENV ?? "development",
    module: input.module ?? "platform",
    metadata: sanitizeAuditMeta(input.metadata ?? {}),
    createdAt: nowIso(),
  };
  const buf = buffer();
  buf.push(row);
  if (buf.length > 2000) buf.splice(0, buf.length - 2000);
  return row;
}

export function listPlatformEvents(limit = 50): ObservabilityRecord[] {
  return buffer().slice(-limit);
}

export function appendObsToAuditState(
  state: PlatformState,
  row: ObservabilityRecord
): PlatformState {
  return {
    ...state,
    audit: [
      ...state.audit,
      {
        id: row.id,
        event: "admin_action",
        userId: row.userId ?? "system",
        workspaceId: row.workspaceId,
        subjectType: "observability",
        subjectId: row.event,
        summary: row.event,
        metadata: { result: row.result, correlationId: row.correlationId },
        createdAt: row.createdAt,
      },
    ],
  };
}
