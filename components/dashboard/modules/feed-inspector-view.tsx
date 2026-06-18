"use client";

import { AlertTriangle, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMountFetch } from "@/hooks/use-mount-fetch";
import { findDuplicateIdempotencyKeys, type FeedInspectorRow } from "@/utils/black-health";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

export function FeedInspectorView() {
  const [rows, setRows] = useState<FeedInspectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feed-inspector");
      const { data, error: parseError } = await parseJsonResponse<{
        rows?: FeedInspectorRow[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Feed Inspector.");
        setRows([]);
        return;
      }

      setRows(data?.rows ?? []);
    } catch {
      setError("Erro de conexão.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(load, [load]);

  const duplicateKeys = useMemo(() => findDuplicateIdempotencyKeys(rows), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.source.toLowerCase().includes(q) ||
        row.entityId.toLowerCase().includes(q) ||
        row.idempotencyKey.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q)
    );
  }, [rows, query]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
      toast.success("Feed Inspector atualizado.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <ListSkeleton rows={8} />;
  }

  if (error) {
    return <EmptyState title="Feed Inspector" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Verifique duplicações por idempotency_key — {rows.length} feed(s) com chave
        </p>
        <ActionButton variant="ghost" disabled={refreshing} onClick={() => void handleRefresh()}>
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Atualizar
        </ActionButton>
      </div>

      {duplicateKeys.size > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {duplicateKeys.size} chave(s) idempotente(s) repetida(s) detectada(s). Linhas duplicadas
            aparecem destacadas.
          </span>
        </div>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Search className="size-3.5 text-sky-400" />
            Feeds auditáveis
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por source, entity, key ou action…"
            className="w-full rounded-md border border-white/[0.08] bg-zinc-950/60 px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-white/[0.15]"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-zinc-500">
                  <th className="px-2 py-2 font-medium">Source</th>
                  <th className="px-2 py-2 font-medium">Entity ID</th>
                  <th className="px-2 py-2 font-medium">Idempotency key</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                  <th className="px-2 py-2 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-zinc-500">
                      Nenhum feed com idempotency_key registrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const isDuplicate =
                      row.idempotencyKey !== "—" &&
                      (duplicateKeys.get(row.idempotencyKey) ?? 0) > 1;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-white/[0.04]",
                          isDuplicate && "bg-amber-500/[0.06]"
                        )}
                      >
                        <td className="px-2 py-2 text-zinc-300">{row.source}</td>
                        <td className="px-2 py-2 font-mono text-[10px] text-zinc-400">{row.entityId}</td>
                        <td className="px-2 py-2 font-mono text-[10px] text-zinc-400">
                          {row.idempotencyKey}
                        </td>
                        <td className="px-2 py-2 text-zinc-300">{row.action}</td>
                        <td className="px-2 py-2 text-zinc-500">
                          {new Date(row.timestamp).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
