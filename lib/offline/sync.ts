import { createClient } from "@/lib/supabase/client";
import {
  OFFLINE_ENABLED_TABLES,
  OFFLINE_SYNC_EVENT,
  type OfflineEnabledTable,
} from "@/lib/offline/constants";
import {
  clearOfflineSyncQueue,
  getOfflineSyncQueue,
  getOfflineTableRows,
  setOfflineSyncQueue,
  setOfflineTableRows,
  type OfflineSyncOp,
} from "@/lib/offline/storage";

type CrudQuery = {
  select: (columns?: string) => {
    order: (
      column: string,
      options?: { ascending?: boolean }
    ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
  };
  insert: (values: Record<string, unknown>) => {
    select: () => {
      single: () => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string
    ) => {
      select: () => {
        single: () => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };
  delete: () => {
    eq: (
      column: string,
      value: string
    ) => Promise<{ error: { message: string } | null }>;
  };
};

const TABLE_ORDER_BY: Record<OfflineEnabledTable, { column: string; ascending: boolean }> = {
  eventos: { column: "data_inicio", ascending: true },
  growth_leads: { column: "created_at", ascending: false },
  health_habits: { column: "data", ascending: false },
  health_workouts: { column: "data", ascending: false },
  health_meals: { column: "data", ascending: false },
  conteudos: { column: "created_at", ascending: false },
};

function getQuery(
  supabase: ReturnType<typeof createClient>,
  table: OfflineEnabledTable
): CrudQuery {
  return supabase.from(table) as unknown as CrudQuery;
}

async function applySyncOp(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  op: OfflineSyncOp
): Promise<void> {
  if (op.type === "insert") {
    const { error } = await getQuery(supabase, op.table)
      .insert({ ...op.payload, id: op.id, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return;
  }

  if (op.type === "update") {
    const { error } = await getQuery(supabase, op.table)
      .update(op.payload)
      .eq("id", op.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await getQuery(supabase, op.table).delete().eq("id", op.id);
  if (error) throw new Error(error.message);
}

async function refreshTableCache(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  table: OfflineEnabledTable
): Promise<void> {
  const { column, ascending } = TABLE_ORDER_BY[table];
  const { data: rows, error } = await getQuery(supabase, table)
    .select("*")
    .order(column, { ascending });
  if (error) throw new Error(error.message);
  setOfflineTableRows(userId, table, (rows ?? []) as Record<string, unknown>[]);
}

let syncRunning = false;

export async function flushOfflineSyncQueue(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.onLine || syncRunning) {
    return false;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const queue = getOfflineSyncQueue(user.id);
  if (queue.length === 0) return true;

  syncRunning = true;
  const failed: OfflineSyncOp[] = [];

  try {
    for (const op of queue) {
      try {
        await applySyncOp(supabase, user.id, op);
      } catch {
        failed.push(op);
      }
    }

    if (failed.length > 0) {
      setOfflineSyncQueue(user.id, failed);
      return false;
    }

    clearOfflineSyncQueue(user.id);

    for (const table of OFFLINE_ENABLED_TABLES) {
      try {
        await refreshTableCache(supabase, user.id, table);
      } catch {
        // mantém cache local se refresh falhar
      }
    }

    return true;
  } catch {
    return false;
  } finally {
    syncRunning = false;
    window.dispatchEvent(new Event(OFFLINE_SYNC_EVENT));
  }
}

export function hasPendingOfflineSync(userId: string): boolean {
  return getOfflineSyncQueue(userId).length > 0;
}

export function getOfflineRowCount(userId: string, table: OfflineEnabledTable): number {
  return getOfflineTableRows(userId, table).length;
}
