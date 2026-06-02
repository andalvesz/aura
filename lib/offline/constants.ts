import type { UserScopedTable } from "@/types/database";

export const OFFLINE_STORAGE_VERSION = 1;
export const OFFLINE_STORAGE_PREFIX = `aura-offline:v${OFFLINE_STORAGE_VERSION}`;

/** Tabelas com cache e fila de sincronização offline. */
export const OFFLINE_ENABLED_TABLES = [
  "eventos",
  "growth_leads",
  "health_habits",
  "health_workouts",
  "health_meals",
  "conteudos",
] as const satisfies readonly UserScopedTable[];

export type OfflineEnabledTable = (typeof OFFLINE_ENABLED_TABLES)[number];

export function isOfflineEnabledTable(
  table: UserScopedTable
): table is OfflineEnabledTable {
  return (OFFLINE_ENABLED_TABLES as readonly string[]).includes(table);
}

export const OFFLINE_SYNC_EVENT = "aura-offline-sync";
