"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  loadClientAuraContext,
  shouldLoadWorkspaceTable,
} from "@/lib/workspace/client-context";
import { isWorkspaceTable } from "@/lib/workspace/constants";
import type { TableInsert, TableRow, TableUpdate, UserScopedTable } from "@/types/database";

type CrudQuery = {
  select: (columns?: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
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
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);
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
      const silent = options?.silent ?? false;

      if (!enabled) {
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError(null);

      try {
        const ctx = await loadClientAuraContext(supabase);

        if (!ctx) {
          setData([]);
          setError("Sessão expirada. Faça login novamente.");
          return;
        }

        if (!shouldLoadWorkspaceTable(table, ctx)) {
          setData([]);
          setError(null);
          return;
        }

        if (offlineTable) {
          const hasPending = getOfflineSyncQueue(ctx.userId).some(
            (op) => op.table === offlineTable
          );
          if (!isOnlineRef.current || hasPending) {
            setData(loadOfflineCache(ctx.userId));
            setError(null);
            return;
          }
        }

        const base = getQuery(supabase, table).select("*");
        const filtered =
          isWorkspaceTable(table) && ctx.activeWorkspaceId
            ? base.eq("workspace_id", ctx.activeWorkspaceId)
            : base;

        const { data: rows, error: err } = await filtered.order(orderBy, {
          ascending,
        });

        if (err) {
          setData([]);
          setError(err.message);
          return;
        }

        const list = (rows ?? []) as TableRow<T>[];
        setData(list);
        setError(null);
        if (offlineTable) {
          persistOfflineCache(list, ctx.userId);
        }
      } catch (cause) {
        console.error(`[useSupabaseCrud] ${table}`, cause);
        setData([]);
        setError(
          cause instanceof Error ? cause.message : "Erro ao carregar dados."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      supabase,
      table,
      orderBy,
      ascending,
      enabled,
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
    async (payload: Omit<TableInsert<T>, "user_id" | "workspace_id">) => {
      setError(null);
      const ctx = await loadClientAuraContext(supabase);
      if (!ctx) {
        const msg = "Sessão expirada. Faça login novamente.";
        setError(msg);
        return { data: null, error: msg };
      }

      if (isWorkspaceTable(table) && !ctx.activeWorkspaceId) {
        const msg = "Selecione o workspace Alvesz para criar este registro.";
        setError(msg);
        return { data: null, error: msg };
      }

      if (offlineTable && !isOnline) {
        const id = newOfflineRowId();
      const row = buildOfflineInsertRow<T>(
          ctx.userId,
          id,
          payload as Omit<TableInsert<T>, "user_id">
        );
        const next = sortOfflineRows(
          [row, ...data],
          orderBy,
          ascending
        ) as TableRow<T>[];
        setData(next);
        persistOfflineCache(next, ctx.userId);
        appendOfflineSyncOp(ctx.userId, {
          type: "insert",
          table: offlineTable,
          id,
          payload: {
            ...(payload as Record<string, unknown>),
            ...(ctx.activeWorkspaceId
              ? { workspace_id: ctx.activeWorkspaceId }
              : {}),
          },
          createdAt: new Date().toISOString(),
        });
        return { data: row, error: null };
      }

      const insertPayload: Record<string, unknown> = {
        ...payload,
        user_id: ctx.userId,
      };
      if (isWorkspaceTable(table) && ctx.activeWorkspaceId) {
        insertPayload.workspace_id = ctx.activeWorkspaceId;
      }

      const { data: row, error: err } = await getQuery(supabase, table)
        .insert(insertPayload)
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
      const ctx = await loadClientAuraContext(supabase);
      if (!ctx) {
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
        persistOfflineCache(next, ctx.userId);
        appendOfflineSyncOp(ctx.userId, {
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
      const ctx = await loadClientAuraContext(supabase);
      if (!ctx) {
        const msg = "Sessão expirada. Faça login novamente.";
        setError(msg);
        return { error: msg };
      }

      if (offlineTable && !isOnline) {
        const next = data.filter((row) => row.id !== id);
        setData(next);
        persistOfflineCache(next, ctx.userId);
        appendOfflineSyncOp(ctx.userId, {
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
