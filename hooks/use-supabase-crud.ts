"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [data, setData] = useState<TableRow<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const { data: rows, error: err } = await getQuery(supabase, table)
      .select("*")
      .order(orderBy, { ascending });
    setData((rows ?? []) as TableRow<T>[]);
    setError(err?.message ?? null);
    setLoading(false);
  }, [supabase, table, orderBy, ascending, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      const { data: row, error: err } = await getQuery(supabase, table)
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (err) {
        setError(err.message);
        return { data: null, error: err.message };
      }
      await refresh();
      return { data: row as TableRow<T>, error: null };
    },
    [supabase, table, refresh]
  );

  const update = useCallback(
    async (id: string, payload: TableUpdate<T>) => {
      setError(null);
      const { data: row, error: err } = await getQuery(supabase, table)
        .update(payload as Record<string, unknown>)
        .eq("id", id)
        .select()
        .single();
      if (err) {
        setError(err.message);
        return { data: null, error: err.message };
      }
      await refresh();
      return { data: row as TableRow<T>, error: null };
    },
    [supabase, table, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      const { error: err } = await getQuery(supabase, table)
        .delete()
        .eq("id", id);
      if (err) {
        setError(err.message);
        return { error: err.message };
      }
      await refresh();
      return { error: null };
    },
    [supabase, table, refresh]
  );

  return { data, loading, error, refresh, create, update, remove };
}
