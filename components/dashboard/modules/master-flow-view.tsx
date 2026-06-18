"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useMasterFlow } from "@/hooks/use-master-flow";
import type { MasterFlowStepStatus } from "@/utils/master-flow";
import type { MasterFlowIntentInput } from "@/utils/master-flow-intent";

function StepIcon({ state }: { state: MasterFlowStepStatus["state"] }) {
  if (state === "completed") return <CheckCircle2 className="size-4 text-emerald-400" />;
  if (state === "active") return <Loader2 className="size-4 animate-spin text-amber-400" />;
  if (state === "failed") return <XCircle className="size-4 text-red-400" />;
  return <Circle className="size-4 text-zinc-600" />;
}

function PipelineStep({ item }: { item: MasterFlowStepStatus }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/[0.06] px-3 py-2">
      <StepIcon state={item.state} />
      <div className="flex-1">
        <p className="text-[12px] font-medium text-zinc-200">{item.label}</p>
        <p className="text-[10px] text-zinc-500 capitalize">{item.state}</p>
      </div>
    </div>
  );
}

export function MasterFlowView() {
  const { status, loading, error, running, refresh, createBusiness, runNextStep } = useMasterFlow();
  const [syncing, setSyncing] = useState(false);
  const [intent, setIntent] = useState<MasterFlowIntentInput>({
    raw: "",
    niche: "",
    country: "",
    language: "",
    avatar: "",
    ticket: null,
  });

  function buildIntentPayload(): MasterFlowIntentInput {
    const ticket = intent.ticket != null && intent.ticket > 0 ? intent.ticket : null;
    return {
      raw: intent.raw?.trim() || null,
      niche: intent.niche?.trim() || null,
      country: intent.country?.trim() || null,
      language: intent.language?.trim() || null,
      avatar: intent.avatar?.trim() || null,
      ticket,
    };
  }

  async function handleCreate() {
    setSyncing(true);
    try {
      const ok = await createBusiness(buildIntentPayload());
      if (ok) toast.success("Pipeline Aura Master Flow iniciado.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRunNext() {
    setSyncing(true);
    try {
      const ok = await runNextStep();
      if (ok) toast.success("Próxima etapa executada.");
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
        <ListSkeleton rows={8} />
      </div>
    );
  }

  const flow = status?.flow;
  const meta =
    flow?.metadata && typeof flow.metadata === "object" && !Array.isArray(flow.metadata)
      ? (flow.metadata as Record<string, unknown>)
      : {};

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader>
          <PanelTitle>Intenção do negócio</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">Descreva o que você quer vender</span>
            <textarea
              value={intent.raw ?? ""}
              onChange={(e) => setIntent((prev) => ({ ...prev, raw: e.target.value }))}
              placeholder='Ex: "Quero vender emagrecimento nos EUA"'
              rows={2}
              className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Nicho</span>
              <input
                value={intent.niche ?? ""}
                onChange={(e) => setIntent((prev) => ({ ...prev, niche: e.target.value }))}
                placeholder="emagrecimento"
                className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">País</span>
              <input
                value={intent.country ?? ""}
                onChange={(e) => setIntent((prev) => ({ ...prev, country: e.target.value }))}
                placeholder="EUA, BR, US"
                className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Idioma</span>
              <input
                value={intent.language ?? ""}
                onChange={(e) => setIntent((prev) => ({ ...prev, language: e.target.value }))}
                placeholder="en-US, pt-BR"
                className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Avatar</span>
              <input
                value={intent.avatar ?? ""}
                onChange={(e) => setIntent((prev) => ({ ...prev, avatar: e.target.value }))}
                placeholder="Mulher 35+ que quer emagrecer"
                className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Ticket (front-end)</span>
              <input
                type="number"
                min={1}
                value={intent.ticket ?? ""}
                onChange={(e) =>
                  setIntent((prev) => ({
                    ...prev,
                    ticket: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder="97"
                className="w-full rounded-md border border-white/[0.08] bg-zinc-900/60 px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </label>
          </div>
        </PanelContent>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={handleCreate} disabled={syncing || running}>
          {syncing || running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          Criar Negócio
        </ActionButton>
        {status?.canRunNext ? (
          <ActionButton variant="ghost" onClick={handleRunNext} disabled={syncing || running}>
            <Play className="size-3.5" />
            Próxima etapa
          </ActionButton>
        ) : null}
        <ActionButton variant="ghost" onClick={handleRefresh} disabled={syncing}>
          <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          Atualizar
        </ActionButton>
      </div>

      {error ? (
        <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {error}
        </p>
      ) : null}

      {!status ? (
        <EmptyState
          title="Nenhum fluxo ativo"
          description="Clique em Criar Negócio para iniciar o pipeline automatizado: Market Hunter → Decision Engine → Product Factory → CopyLab → Offer Engine → Funnel Engine → Funnel Pages → Creative Director → Ads Commander → Excellence."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Progresso"
              value={`${flow?.progress ?? 0}%`}
              hint={status.currentLabel}
            />
            <MetricCard
              label="Status"
              value={flow?.status ?? "—"}
              hint={status.isComplete ? "Pipeline concluído" : "Em execução"}
            />
            <MetricCard
              label="Produto"
              value={(meta.opportunity_name as string) ?? "—"}
              hint={
                (meta.niche as string)
                  ? `${meta.niche as string}${meta.country ? ` · ${meta.country as string}` : ""}`
                  : flow?.product_id
                    ? "Vinculado"
                    : "Pendente"
              }
            />
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Pipeline automatizado</PanelTitle>
            </PanelHeader>
            <PanelContent className="space-y-2">
              {status.steps.map((step) => (
                <PipelineStep key={step.step} item={step} />
              ))}
            </PanelContent>
          </Panel>

          {status.isComplete ? (
            <Panel>
              <PanelHeader>
                <PanelTitle>Resultado</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-1 text-[12px] text-zinc-300">
                {flow?.product_id ? <p>Produto: {flow.product_id}</p> : null}
                {flow?.funnel_id ? <p>Funil: {flow.funnel_id}</p> : null}
                {flow?.campaign_id ? <p>Campanha: {flow.campaign_id}</p> : null}
              </PanelContent>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
