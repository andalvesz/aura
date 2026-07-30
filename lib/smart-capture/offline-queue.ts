/**
 * Offline capture queue — localStorage (browser) + pure helpers for tests.
 */

import {
  newSmartCaptureId,
  type OfflineCaptureItem,
  type SmartCaptureInput,
  type SyncItemStatus,
  type SyncPanelSnapshot,
} from "@/lib/smart-capture/types";

export const SMART_CAPTURE_QUEUE_PREFIX = "aura-smart-capture:v1";
export const SMART_CAPTURE_SYNC_EVENT = "aura-smart-capture-sync";

function queueKey(userId: string): string {
  return `${SMART_CAPTURE_QUEUE_PREFIX}:${userId}:queue`;
}

function lastSyncKey(userId: string): string {
  return `${SMART_CAPTURE_QUEUE_PREFIX}:${userId}:lastSync`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

export function createOfflineCaptureItem(
  userId: string,
  payload: SmartCaptureInput
): OfflineCaptureItem {
  const now = new Date().toISOString();
  return {
    id: newSmartCaptureId("offcap"),
    userId,
    payload,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    lastError: null,
    attempts: 0,
  };
}

export function getOfflineCaptureQueue(userId: string): OfflineCaptureItem[] {
  return readJson<OfflineCaptureItem[]>(queueKey(userId)) ?? [];
}

export function setOfflineCaptureQueue(
  userId: string,
  items: OfflineCaptureItem[]
): void {
  writeJson(queueKey(userId), items);
}

export function enqueueOfflineCapture(
  userId: string,
  payload: SmartCaptureInput
): OfflineCaptureItem {
  const item = createOfflineCaptureItem(userId, payload);
  const queue = getOfflineCaptureQueue(userId);
  queue.unshift(item);
  setOfflineCaptureQueue(userId, queue);
  return item;
}

export function updateOfflineCaptureStatusPure(
  items: OfflineCaptureItem[],
  id: string,
  status: SyncItemStatus,
  lastError: string | null = null
): OfflineCaptureItem[] {
  const now = new Date().toISOString();
  return items.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status,
      lastError,
      updatedAt: now,
      attempts:
        status === "syncing" || status === "failed"
          ? item.attempts + (status === "syncing" ? 1 : 0)
          : item.attempts,
    };
  });
}

export function buildSyncPanelSnapshot(
  items: OfflineCaptureItem[],
  lastSyncAt: string | null
): SyncPanelSnapshot {
  return {
    pending: items.filter((i) => i.status === "pending" || i.status === "syncing")
      .length,
    sent: items.filter((i) => i.status === "sent").length,
    failed: items.filter((i) => i.status === "failed").length,
    lastSyncAt,
    items: [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export function getLastSmartCaptureSync(userId: string): string | null {
  return readJson<string>(lastSyncKey(userId));
}

export function setLastSmartCaptureSync(userId: string, iso: string): void {
  writeJson(lastSyncKey(userId), iso);
}

export function getSyncPanel(userId: string): SyncPanelSnapshot {
  return buildSyncPanelSnapshot(
    getOfflineCaptureQueue(userId),
    getLastSmartCaptureSync(userId)
  );
}

export function emitSmartCaptureSyncEvent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SMART_CAPTURE_SYNC_EVENT));
}
