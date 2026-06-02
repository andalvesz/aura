import {
  OFFLINE_STORAGE_PREFIX,
  type OfflineEnabledTable,
} from "@/lib/offline/constants";

export type OfflineSyncInsertOp = {
  type: "insert";
  table: OfflineEnabledTable;
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type OfflineSyncUpdateOp = {
  type: "update";
  table: OfflineEnabledTable;
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type OfflineSyncDeleteOp = {
  type: "delete";
  table: OfflineEnabledTable;
  id: string;
  createdAt: string;
};

export type OfflineSyncOp =
  | OfflineSyncInsertOp
  | OfflineSyncUpdateOp
  | OfflineSyncDeleteOp;

type OfflineTableSnapshot = {
  rows: Record<string, unknown>[];
  savedAt: string;
};

function tableKey(userId: string, table: OfflineEnabledTable): string {
  return `${OFFLINE_STORAGE_PREFIX}:${userId}:${table}`;
}

function queueKey(userId: string): string {
  return `${OFFLINE_STORAGE_PREFIX}:${userId}:queue`;
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
    // quota ou modo privado — ignorar
  }
}

export function getOfflineTableRows<T extends Record<string, unknown>>(
  userId: string,
  table: OfflineEnabledTable
): T[] {
  const snapshot = readJson<OfflineTableSnapshot>(tableKey(userId, table));
  return (snapshot?.rows ?? []) as T[];
}

export function setOfflineTableRows(
  userId: string,
  table: OfflineEnabledTable,
  rows: Record<string, unknown>[]
): void {
  writeJson(tableKey(userId, table), {
    rows,
    savedAt: new Date().toISOString(),
  } satisfies OfflineTableSnapshot);
}

export function getOfflineSyncQueue(userId: string): OfflineSyncOp[] {
  return readJson<OfflineSyncOp[]>(queueKey(userId)) ?? [];
}

export function setOfflineSyncQueue(userId: string, queue: OfflineSyncOp[]): void {
  writeJson(queueKey(userId), queue);
}

export function appendOfflineSyncOp(userId: string, op: OfflineSyncOp): void {
  const queue = getOfflineSyncQueue(userId);
  queue.push(op);
  setOfflineSyncQueue(userId, queue);
}

export function clearOfflineSyncQueue(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(queueKey(userId));
  } catch {
    // ignore
  }
}
