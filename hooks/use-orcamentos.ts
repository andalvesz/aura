"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadClientAuraContext } from "@/lib/workspace/client-context";
import type { Orcamento } from "@/types/database";

export type OrcamentoWithCliente = Orcamento;

export function useOrcamentos() {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<OrcamentoWithCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ctx = await loadClientAuraContext(supabase);
    if (!ctx?.activeWorkspaceId) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    const { data: rows, error: err } = await supabase
      .from("orcamentos")
      .select("*")
      .eq("workspace_id", ctx.activeWorkspaceId)
      .order("created_at", { ascending: false });
    setData((rows ?? []) as unknown as OrcamentoWithCliente[]);
    setError(err?.message ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (payload: {
      cliente_id: string | null;
      tipo_evento: string;
      convidados: number;
      valor_total: number;
      lucro_estimado: number;
      status?: string;
      data_evento?: string | null;
      local?: string | null;
      observacoes?: string | null;
    }) => {
      const ctx = await loadClientAuraContext(supabase);
      if (!ctx?.userId) return { data: null, error: "Sessão expirada." };
      if (!ctx.activeWorkspaceId) {
        return { data: null, error: "Selecione o workspace Alvesz." };
      }

      const { data: row, error: err } = await supabase
        .from("orcamentos")
        .insert({
          ...payload,
          user_id: ctx.userId,
          workspace_id: ctx.activeWorkspaceId,
          status: payload.status ?? "rascunho",
        })
        .select()
        .single();

      if (err) return { data: null, error: err.message };
      await refresh();
      return { data: row as Orcamento, error: null };
    },
    [supabase, refresh]
  );

  const update = useCallback(
    async (id: string, payload: Partial<Orcamento>) => {
      const { error: err } = await supabase
        .from("orcamentos")
        .update(payload)
        .eq("id", id);
      if (err) return { error: err.message };
      await refresh();
      return { error: null };
    },
    [supabase, refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.from("orcamentos").delete().eq("id", id);
      if (err) return { error: err.message };
      setData((prev) => prev.filter((o) => o.id !== id));
      return { error: null };
    },
    [supabase]
  );

  return { data, loading, error, refresh, create, update, remove };
}
