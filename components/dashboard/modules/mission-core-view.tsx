"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Lightbulb,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMissionCore } from "@/hooks/use-mission-core";
import {
  countMissionAssetsReady,
  missionStepProgressLabel,
  type MissionProductAdherence,
  type MissionSalesPackageView,
  type MissionStrategySummary,
} from "@/utils/mission-core";

function PackageAssetRow({
  label,
  ready,
  score,
  detail,
}: {
  label: string;
  ready: boolean;
  score?: number;
  detail?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-white/[0.06] px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        {ready ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        ) : (
          <Circle className="mt-0.5 size-4 shrink-0 text-zinc-600" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-zinc-200">{label}</p>
          <p className="text-[10px] text-zinc-500">{detail ?? (ready ? "Pronto" : "Pendente")}</p>
        </div>
      </div>
      {score != null ? (
        <span className="shrink-0 text-[11px] font-medium text-zinc-400">{Math.round(score)}</span>
      ) : null}
    </div>
  );
}

function MissionStrategyPanel({ strategy }: { strategy: MissionStrategySummary }) {
  return (
    <Panel className="border-violet-500/20 bg-violet-500/[0.04]">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-violet-300">
          <Lightbulb className="size-4" />
          Estratégia escolhida
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-white/[0.06] px-3 py-2">
          <p className="text-[10px] text-zinc-500">Tipo</p>
          <p className="text-[12px] font-medium text-zinc-100">{strategy.name}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] px-3 py-2">
          <p className="text-[10px] text-zinc-500">Ticket</p>
          <p className="text-[12px] font-medium text-zinc-100">
            R$ {strategy.ticket.toLocaleString("pt-BR")}
          </p>
        </div>
      </PanelContent>
    </Panel>
  );
}

function MissionProductAdherencePanel({ adherence }: { adherence: MissionProductAdherence }) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <Package className="size-4 text-cyan-400" />
          Aderência do produto à estratégia
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <p className="text-[12px] text-zinc-300">
          Score {Math.round(adherence.score)}/100 —{" "}
          {adherence.aligned ? "Alinhado" : "Ajustes necessários"}
        </p>
      </PanelContent>
    </Panel>
  );
}

function MissionReviewPanel({
  mission,
  salesPackage,
  onApprove,
  approving,
}: {
  mission: NonNullable<ReturnType<typeof useMissionCore>["mission"]>;
  salesPackage: MissionSalesPackageView;
  onApprove: () => void;
  approving: boolean;
}) {
  const canApprove =
    salesPackage.commercialScore >= 90 &&
    mission.investment_approved &&
    !mission.mission_launch_approved;

  return (
    <Panel className="border-emerald-500/20 bg-emerald-500/[0.04]">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="size-4" />
          Missão pronta para revisão
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Commercial Score</p>
            <p className="text-xl font-bold text-emerald-400">
              {Math.round(salesPackage.commercialScore)}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Investment Score</p>
            <p
              className={`text-xl font-bold ${
                (mission.investment_score ?? 0) >= 90 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {mission.investment_score != null ? Math.round(mission.investment_score) : "—"}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Ready To Sell</p>
            <p
              className={`text-xl font-bold ${
                salesPackage.readyToSell ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {salesPackage.readyToSell ? "SIM" : "NÃO"}
            </p>
          </div>
          <div className="rounded-md border border-white/[0.06] px-3 py-2">
            <p className="text-[10px] text-zinc-500">Investment Approved</p>
            <p
              className={`text-xl font-bold ${
                mission.investment_approved ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {mission.investment_approved ? "SIM" : "NÃO"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <PackageAssetRow label="Produto" ready={salesPackage.product.ready} score={salesPackage.product.score} />
          <PackageAssetRow label="Oferta" ready={salesPackage.offer.ready} score={salesPackage.offer.score} />
          <PackageAssetRow
            label="Landing"
            ready={salesPackage.landing.ready}
            score={salesPackage.landing.score}
            detail={salesPackage.landing.url}
          />
          <PackageAssetRow label="Copy" ready={salesPackage.copy.ready} score={salesPackage.copy.score} />
          <PackageAssetRow
            label="Criativos"
            ready={salesPackage.creatives.ready}
            score={salesPackage.creatives.score}
          />
          <PackageAssetRow
            label="Checkout"
            ready={salesPackage.checkout.ready}
            score={salesPackage.checkout.score}
            detail={salesPackage.checkout.url}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Checklist</p>
          <div className="space-y-1.5">
            {mission.publication_checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-[11px]">
                {item.done ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                ) : (
                  <Circle className="size-3.5 text-zinc-600" />
                )}
                <span className={item.done ? "text-zinc-300" : "text-zinc-500"}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {(salesPackage.pendingItems.length > 0 || mission.pendencies.length > 0) ? (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="mb-2 text-[11px] font-medium text-amber-200">Pendências</p>
            <ul className="space-y-1">
              {[...salesPackage.pendingItems, ...mission.pendencies].map((item) => (
                <li key={item} className="text-[11px] text-amber-100/80">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!mission.investment_approved && mission.investment_must_fix.length > 0 ? (
          <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
            <p className="mb-2 text-[11px] font-medium text-red-200">
              Não recomendo investir dinheiro nesta missão
            </p>
            <p className="mb-2 text-[11px] text-red-100/80">
              {mission.investment_recommendation}
            </p>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-red-300/80">
              Correções prioritárias
            </p>
            <ul className="space-y-1">
              {mission.investment_must_fix.map((item) => (
                <li key={item} className="text-[11px] text-red-100/80">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {mission.investment_specialists.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Investment Committee
            </p>
            <div className="space-y-2">
              {mission.investment_specialists.map((specialist) => (
                <div
                  key={specialist.name}
                  className="rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-zinc-200">{specialist.name}</p>
                    <span
                      className={`text-[11px] font-medium ${
                        specialist.approved ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {Math.round(specialist.score)}/100
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{specialist.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!mission.mission_launch_approved ? (
          <>
            <ActionButton
              variant="primary"
              className="min-h-11 w-full gap-2"
              onClick={onApprove}
              disabled={approving || !canApprove}
            >
              {approving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              APROVAR PARA LANÇAMENTO
            </ActionButton>
            {!canApprove ? (
              <p className="text-[11px] text-zinc-500">
                Requer Commercial Score ≥ 90 e Investment Approved.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[12px] text-emerald-300">
            Missão aprovada para lançamento. Publicação manual ainda necessária.
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}

export function MissionCoreView() {
  const { mission, loading, error, running, refresh, startMission, advanceMission, approveMission } =
    useMissionCore();
  const [objective, setObjective] = useState("");
  const [syncing, setSyncing] = useState(false);

  async function handleStart() {
    if (!objective.trim()) {
      toast.error("Descreva o objetivo da missão.");
      return;
    }
    setSyncing(true);
    try {
      const ok = await startMission({ raw: objective.trim() });
      if (ok) toast.success("Missão iniciada — gerando pacote comercial completo.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAdvance() {
    setSyncing(true);
    try {
      const ok = await advanceMission();
      if (ok) toast.success("Missão atualizada.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove() {
    setSyncing(true);
    try {
      const ok = await approveMission();
      if (ok) toast.success("Missão aprovada para lançamento.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      await refresh();
      toast.success("Status atualizado.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={3} />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  const salesPackage = mission?.sales_package ?? null;
  const assetsReady = mission ? countMissionAssetsReady(mission.artifacts) : 0;
  const inReview = Boolean(salesPackage && (mission?.is_ready_for_review || mission?.blocked_reason));

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Rocket className="size-4 text-cyan-400" />
            Nova missão
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">Objetivo da missão</span>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder='Ex: "Quero criar um negócio de emagrecimento para mulheres 40+"'
              rows={3}
              disabled={running || syncing}
              className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              onClick={handleStart}
              disabled={running || syncing || !objective.trim()}
              className="min-h-11"
            >
              {running || syncing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Criar Missão
            </ActionButton>
            {mission && !inReview ? (
              <ActionButton
                variant="ghost"
                onClick={handleAdvance}
                disabled={running || syncing || mission.is_complete}
                className="min-h-11"
              >
                <Play className="size-4" />
                Continuar missão
              </ActionButton>
            ) : null}
            <ActionButton variant="ghost" onClick={handleRefresh} disabled={syncing} className="min-h-11">
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              Atualizar
            </ActionButton>
          </div>
        </PanelContent>
      </Panel>

      {error ? (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      ) : null}

      {!mission ? (
        <EmptyState
          title="Nenhuma missão ativa"
          description="O Aura gera automaticamente produto, oferta, landing, copy, criativos e checkout em um único pacote comercial."
        />
      ) : inReview && salesPackage ? (
        <MissionReviewPanel
          mission={mission}
          salesPackage={salesPackage}
          onApprove={() => void handleApprove()}
          approving={syncing || running}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Progresso" value={`${mission.progress}%`} hint="Missão comercial" />
            <MetricCard label="Ativos prontos" value={`${assetsReady}/6`} hint="Pacote comercial" />
            <MetricCard
              label="Status"
              value={mission.blocked_reason ? "Revisão" : mission.is_complete ? "Concluída" : "Gerando"}
              hint={missionStepProgressLabel(mission.current_step)}
            />
          </div>

          {mission.status === "failed" || mission.failed_step ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>{mission.last_error ?? "A missão encontrou um erro."}</span>
            </div>
          ) : null}

          {mission.selected_strategy ? (
            <MissionStrategyPanel strategy={mission.selected_strategy} />
          ) : null}

          {mission.product_adherence ? (
            <MissionProductAdherencePanel adherence={mission.product_adherence} />
          ) : null}

          <Panel>
            <PanelHeader>
              <PanelTitle>Próximo passo</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <p className="text-[12px] text-zinc-300">{mission.next_action}</p>
            </PanelContent>
          </Panel>
        </>
      )}
    </div>
  );
}
