import type { TableInsert, TableRow, TableUpdate, UserScopedTable } from "@/types/database";
import type { OfflineEnabledTable } from "@/lib/offline/constants";

export function newOfflineRowId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildOfflineInsertRow<T extends UserScopedTable>(
  userId: string,
  id: string,
  payload: Omit<TableInsert<T>, "user_id">
): TableRow<T> {
  const now = new Date().toISOString();
  return {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    ...payload,
  } as TableRow<T>;
}

export function mergeOfflineUpdateRow<T extends UserScopedTable>(
  existing: TableRow<T>,
  payload: TableUpdate<T>
): TableRow<T> {
  return {
    ...existing,
    ...payload,
    updated_at: new Date().toISOString(),
  } as TableRow<T>;
}

export function sortOfflineRows<T extends Record<string, unknown>>(
  rows: T[],
  orderBy: string,
  ascending: boolean
): T[] {
  return [...rows].sort((a, b) => {
    const av = a[orderBy];
    const bv = b[orderBy];
    if (av === bv) return 0;
    if (av == null) return ascending ? -1 : 1;
    if (bv == null) return ascending ? 1 : -1;
    if (av < bv) return ascending ? -1 : 1;
    if (av > bv) return ascending ? 1 : -1;
    return 0;
  });
}

export function toOfflineTable(table: UserScopedTable): OfflineEnabledTable | null {
  const tables = [
    "eventos",
    "growth_leads",
    "health_habits",
    "health_workouts",
    "health_meals",
    "conteudos",
  ] as const;
  return (tables as readonly string[]).includes(table)
    ? (table as OfflineEnabledTable)
    : null;
}
