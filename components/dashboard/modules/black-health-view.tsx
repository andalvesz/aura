"use client";

import {
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { BlackHealthCardSnapshot } from "@/utils/black-health";
import type { SystemLogTipo } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";
import { systemLogTipoLabel } from "@/utils/system-logs";
import { cn } from "@/utils/cn";
import { useMountFetch } from "@/hooks/use-mount-fetch";

function TipoBadge({ tipo }: { tipo: SystemLogTipo }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tipo === "success" && "bg-emerald-500/10 text-emerald-400",
        tipo === "warning" && "bg-amber-500/10 text-amber-400",
        tipo === "info" && "bg-sky-500/10 text-sky-400",
        tipo === "error" && "bg-rose-500/10 text-rose-400"
      )}
    >
      {systemLogTipoLabel(tipo)}
    </span>
  );
}

function HealthCard({ card }: { card: BlackHealthCardSnapshot }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="text-[13px]">{card.label}</PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3">
        <p className="text-[11px] text-zinc-500">{card.description}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Execuções" value={String(card.total)} />
          <MetricCard
            label="Success rate"
            value={`${card.successRate.toFixed(1)}%`}
            hintClassName={card.successRate >= 90 ? "text-emerald-400" : "text-amber-400"}
          />
          <MetricCard label="Erros" value={String(card.errors)} hintClassName="text-rose-400" />
          <MetricCard label="Warnings" value={String(card.warnings)} hintClassName="text-amber-400" />
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-white/[0.06] p-2">
          {card.recentLogs.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Nenhuma execução registrada.</p>
          ) : (
            card.recentLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-2 border-b border-white/[0.04] py-1 last:border-0">
                <TipoBadge tipo={log.tipo} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-zinc-300">{log.mensagem}</p>
                  <p className="text-[10px] text-zinc-600">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </PanelContent>
    </Panel>
  );
}

export function BlackHealthView() {
  const [cards, setCards] = useState<BlackHealthCardSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/black-health");
      const { data, error: parseError } = await parseJsonResponse<{
        cards?: BlackHealthCardSnapshot[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Black Health.");
        setCards([]);
        return;
      }

      setCards(data?.cards ?? []);
    } catch {
      setError("Erro de conexão.");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountFetch(load, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
      toast.success("Black Health atualizado.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Black Health" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Observabilidade Aura Black — últimas execuções via system_logs
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

      <div className="grid gap-3 xl:grid-cols-2">
        {cards.map((card) => (
          <HealthCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
