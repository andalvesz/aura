"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OFFLINE_SYNC_EVENT } from "@/lib/offline/constants";
import {
  appendOfflineSyncOp,
  getOfflineSyncQueue,
  getOfflineTableRows,
  setOfflineTableRows,
} from "@/lib/offline/storage";
import {
  buildOfflineInsertRow,
  mergeOfflineUpdateRow,
  newOfflineRowId,
  sortOfflineRows,
  toOfflineTable,
} from "@/lib/offline/row";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { TableInsert, TableRow, TableUpdate, UserScopedTable } from "@/types/database";

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

type UseSupabaseCrudOptions<T extends UserScopedTable> = {
  table: T;
  orderBy?: string;
  ascending?: boolean;
  enabled?: boolean;
};

function getQuery(
  supabase: ReturnType<typeof createClient>,
  table: UserScopedTable
): CrudQuery {
  return supabase.from(table) as unknown as CrudQuery;
}

export function useSupabaseCrud<T extends UserScopedTable>({
  table,
  orderBy = "created_at",
  ascending = false,
  enabled = true,
}: UseSupabaseCrudOptions<T>) {
  const supabase = useMemo(() => createClient(), []);
  const isOnline = useOnlineStatus();
  const offlineTable = toOfflineTable(table);
  const [data, setData] = useState<TableRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistOfflineCache = useCallback(
    (rows: TableRow<T>[], userId: string) => {
      if (!offlineTable) return;
      setOfflineTableRows(
        userId,
        offlineTable,
        rows as unknown as Record<string, unknown>[]
      );
    },
    [offlineTable]
  );

  const loadOfflineCache = useCallback(
    (userId: string) => {
      if (!offlineTable) return [] as TableRow<T>[];
      return sortOfflineRows(
        getOfflineTableRows<TableRow<T>>(userId, offlineTable),
        orderBy,
        ascending
      );
    },
    [offlineTable, orderBy, ascending]
  );

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!enabled) return;
      if (!options?.silent) setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (offlineTable && user) {
        const hasPending = getOfflineSyncQueue(user.id).some(
          (op) => op.table === offlineTable
        );
        if (!isOnline || hasPending) {
          setData(loadOfflineCache(user.id));
          setError(null);
          if (!options?.silent) setLoading(false);
          return;
        }
      }

      const { data: rows, error: err } = await getQuery(supabase, table)
        .select("*")
        .order(orderBy, { ascending });
      setData((rows ?? []) as TableRow<T>[]);
      setError(err?.message ?? null);
      if (!err && user && offlineTable) {
        persistOfflineCache((rows ?? []) as TableRow<T>[], user.id);
      }
      if (!options?.silent) setLoading(false);
    },
    [
      supabase,
      table,
      orderBy,
      ascending,
      enabled,
      isOnline,
      offlineTable,
      loadOfflineCache,
      persistOfflineCache,
    ]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!offlineTable) return;
    const onSynced = () => {
      void refresh({ silent: true });
    };
    window.addEventListener(OFFLINE_SYNC_EVENT, onSynced);
    return () => window.removeEventListener(OFFLINE_SYNC_EVENT, onSynced);
  }, [offlineTable, refresh]);

  const create = useCallback(
    async (payload: Omit<TableInsert<T>, "user_id">) => {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const msg = "Sessão expirada. Faça login novamente.";
        setError(msg);
        return { data: null, error: msg };
      }

      if (offlineTable && !isOnline) {
        const id = newOfflineRowId();
        const row = buildOfflineInsertRow<T>(user.id, id, payload);
        const next = sortOfflineRows(
          [row, ...data],
          orderBy,
          ascending
        ) as TableRow<T>[];
        setData(next);
        persistOfflineCache(next, user.id);
        appendOfflineSyncOp(user.id, {
          type: "insert",
          table: offlineTable,
          id,
          payload: payload as Record<string, unknown>,
          createdAt: new Date().toISOString(),
        });
        return { data: row, error: null };
      }

      const { data: row, error: err } = await getQuery(supabase, table)
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (err) {
        setError(err.message);
        return { data: null, error: err.message };
      }
      if (row) {
        setData((prev) => [row as TableRow<T>, ...prev]);
      } else {
        await refresh({ silent: true });
      }
      return { data: row as TableRow<T>, error: null };
    },
    [
      supabase,
      table,
      refresh,
      isOnline,
      offlineTable,
      data,
      orderBy,
      ascending,
      persistOfflineCache,
    ]
  );

  const update = useCallback(
    async (id: string, payload: TableUpdate<T>) => {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const msg = "Sessão expirada. Faça login novamente.";
        setError(msg);
        return { data: null, error: msg };
      }

      if (offlineTable && !isOnline) {
        const existing = data.find((row) => row.id === id);
        if (!existing) {
          const msg = "Registro não encontrado no cache offline.";
          setError(msg);
          return { data: null, error: msg };
        }
        const row = mergeOfflineUpdateRow(existing, payload);
        const next = sortOfflineRows(
          data.map((item) => (item.id === id ? row : item)),
          orderBy,
          ascending
        ) as TableRow<T>[];
        setData(next);
        persistOfflineCache(next, user.id);
        appendOfflineSyncOp(user.id, {
          type: "update",
          table: offlineTable,
          id,
          payload: payload as Record<string, unknown>,
          createdAt: new Date().toISOString(),
        });
        return { data: row, error: null };
      }

      const previous = data;
      setData((prev) =>
        prev.map((row) =>
          row.id === id ? ({ ...row, ...payload } as TableRow<T>) : row
        )
      );
      const { data: row, error: err } = await getQuery(supabase, table)
        .update(payload as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();
      if (err) {
        setData(previous);
        setError(err.message);
        return { data: null, error: err.message };
      }
      if (row) {
        setData((prev) =>
          prev.map((item) => (item.id === id ? (row as TableRow<T>) : item))
        );
      } else {
        await refresh({ silent: true });
      }
      return { data: row as TableRow<T>, error: null };
    },
    [
      supabase,
      table,
      refresh,
      data,
      isOnline,
      offlineTable,
      orderBy,
      ascending,
      persistOfflineCache,
    ]
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const msg = "Sessão expirada. Faça login novamente.";
        setError(msg);
        return { error: msg };
      }

      if (offlineTable && !isOnline) {
        const next = data.filter((row) => row.id !== id);
        setData(next);
        persistOfflineCache(next, user.id);
        appendOfflineSyncOp(user.id, {
          type: "delete",
          table: offlineTable,
          id,
          createdAt: new Date().toISOString(),
        });
        return { error: null };
      }

      const previous = data;
      setData((prev) => prev.filter((row) => row.id !== id));
      const { error: err } = await getQuery(supabase, table)
        .delete()
        .eq("id", id);
      if (err) {
        setData(previous);
        setError(err.message);
        return { error: err.message };
      }
      return { error: null };
    },
    [supabase, table, data, isOnline, offlineTable, persistOfflineCache]
  );

  return { data, loading, error, refresh, create, update, remove };
}
