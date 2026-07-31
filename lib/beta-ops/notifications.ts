/**
 * In-app ops notifications (no external email in this sprint).
 */

import { newId, nowIso, type BetaOpsState } from "@/lib/beta-ops/store";
import type { OpsNotification } from "@/lib/beta-ops/types";

export function createOpsNotification(
  state: BetaOpsState,
  input: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    href?: string | null;
  }
): BetaOpsState {
  const n: OpsNotification = {
    id: newId("opsn"),
    userId: input.userId,
    kind: input.kind,
    title: input.title.slice(0, 200),
    body: input.body.slice(0, 1000),
    href: input.href ?? null,
    read: false,
    createdAt: nowIso(),
  };
  return { ...state, notifications: [...state.notifications, n] };
}

export function listOpsNotifications(
  userId: string,
  state: BetaOpsState
): OpsNotification[] {
  return state.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markOpsNotificationRead(
  state: BetaOpsState,
  userId: string,
  notificationId: string
): BetaOpsState {
  return {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId && n.userId === userId ? { ...n, read: true } : n
    ),
  };
}
