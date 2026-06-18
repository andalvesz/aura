"use client";

import { useState } from "react";
import {
  Award,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAuraExcellence } from "@/hooks/use-aura-excellence";
import {
  EXCELLENCE_ASSET_LABELS,
  EXCELLENCE_SAFE_MODE,
  MARKET_LEADER_MODE,
  excellenceStatusColor,
  excellenceStatusLabel,
  formatExcellenceScore,
  type ExcellenceAssetCard,
} from "@/utils/aura-excellence";

function AssetCard({ card }: { card: ExcellenceAssetCard }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-100">{card.label}</p>
          <p className="text-[10px] text-zinc-500">
            {EXCELLENCE_ASSET_LABELS[card.assetType]} · {card.assetId.slice(0, 8)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold text-zinc-100">{formatExcellenceScore(card.finalScore)}</p>
          {card.excellenceScore != null || card.benchmarkScore != null ? (
            <p className="text-[9px] text-zinc-500">
              E {card.excellenceScore != null ? formatExcellenceScore(card.excellenceScore) : "—"} · B{" "}
              {card.benchmarkScore != null ? formatExcellenceScore(card.benchmarkScore) : "—"}
            </p>
          ) : null}
          <p className={`text-[10px] ${excellenceStatusColor(card.status)}`}>
            {excellenceStatusLabel(card.status)}
          </p>
        </div>
      </div>
      {card.regenerationCount > 0 ? (
        <p className="mt-1 text-[10px] text-amber-400/80">
          Regenerações: {card.regenerationCount}
        </p>
      ) : null}
    </div>
  );
}

export function ExcellenceView() {
  const { dashboard, scores, loading, error, busy, refresh, approve, reject } = useAuraExcellence();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Excellence Engine atualizado.");
    } finally {
      setSyncing(false);
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
    return <EmptyState title="Aura Excellence Engine" description={error} />;
  }

  return (
    <div className="space-y-3">
      {EXCELLENCE_SAFE_MODE.active ? (
        <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11px] text-violet-200/90">
          {EXCELLENCE_SAFE_MODE.message}
        </div>
      ) : null}

      {MARKET_LEADER_MODE.active ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200/90">
          {MARKET_LEADER_MODE.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={handleRefresh} disabled={syncing || busy}>
          {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Atualizar
        </ActionButton>
        <span className="text-[10px] text-zinc-500">
          Score Final = Excellence + Benchmark · ≥ 85 aprovado · 70–84 regenerar · &lt;70 bloqueado
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ativos aprovados"
          value={String(dashboard?.ativosAprovados ?? 0)}
          hint="Prontos para entrega"
        />
        <MetricCard
          label="Ativos reprovados"
          value={String(dashboard?.ativosReprovados ?? 0)}
          hint="Entrega bloqueada"
        />
        <MetricCard
          label="Média geral"
          value={formatExcellenceScore(dashboard?.mediaGeral ?? 0)}
          hint={`${dashboard?.totalAuditorias ?? 0} auditorias`}
        />
        <MetricCard
          label="Pendentes regeneração"
          value={String(dashboard?.pendentesRegeneracao ?? 0)}
          hint="Score entre 70 e 84"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Star className="size-3.5 text-yellow-400" />
              Melhores ativos
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {dashboard?.melhoresAtivos.length ? (
              dashboard.melhoresAtivos.map((card) => (
                <AssetCard key={`${card.assetType}:${card.assetId}`} card={card} />
              ))
            ) : (
              <p className="text-[11px] text-zinc-500">Nenhum ativo aprovado ainda.</p>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Award className="size-3.5 text-amber-400" />
              Ativos para melhoria
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {dashboard?.ativosParaMelhoria.length ? (
              dashboard.ativosParaMelhoria.map((card) => (
                <AssetCard key={`${card.assetType}:${card.assetId}`} card={card} />
              ))
            ) : (
              <p className="text-[11px] text-zinc-500">Todos os ativos auditados estão acima de 85.</p>
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ShieldCheck className="size-3.5 text-violet-400" />
            Auditorias recentes
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {scores.length ? (
            scores.slice(0, 12).map((score) => {
              const card: ExcellenceAssetCard = {
                assetType: score.asset_type,
                assetId: score.asset_id,
                label: `${EXCELLENCE_ASSET_LABELS[score.asset_type]} · ${score.asset_id.slice(0, 8)}`,
                finalScore: score.final_score,
                excellenceScore: score.excellence_score,
                benchmarkScore: score.benchmark_score,
                approved: score.approved,
                status:
                  score.final_score >= 85
                    ? "approved"
                    : score.final_score >= 70
                      ? "regenerate"
                      : "blocked",
                regenerationCount: score.regeneration_count,
                updatedAt: score.updated_at,
              };

              return (
                <div
                  key={score.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <AssetCard card={card} />
                  <div className="flex gap-1">
                    {score.final_score >= 85 ? (
                      <ActionButton
                        disabled={busy || score.approved}
                        onClick={async () => {
                          const ok = await approve(score.asset_type, score.asset_id);
                          if (ok) toast.success("Ativo aprovado.");
                        }}
                      >
                        Aprovar
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await reject(score.asset_type, score.asset_id);
                        if (ok) toast.success("Ativo reprovado.");
                      }}
                    >
                      Reprovar
                    </ActionButton>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-zinc-500">
              Nenhuma auditoria registrada. Ativos gerados pela Aura passarão por especialistas antes da entrega.
            </p>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
