"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Image,
  Layout,
  Loader2,
  Megaphone,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useOperationCenter } from "@/hooks/use-operation-center";
import { cn } from "@/utils/cn";
import {
  getOperationStatusColor,
  getOperationStatusLabel,
  getOperationStepStatusColor,
  getOperationStepStatusLabel,
  type OperationStepStatus,
} from "@/utils/operation-center";

function StepBadge({ status }: { status: OperationStepStatus }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        getOperationStepStatusColor(status)
      )}
    >
      {getOperationStepStatusLabel(status)}
    </span>
  );
}

export function OperationCenterView() {
  const {
    dashboard,
    loading,
    backgroundLoading,
    error,
    busy,
    refresh,
    generateAssets,
    prepareCampaign,
    sendToPerformanceAi,
    approveOperation,
    cancelOperation,
  } = useOperationCenter();

  const operation = dashboard?.operation;
  const canMutate = dashboard?.canMutate ?? false;

  async function handleGenerateCreatives() {
    const { message, error: actionError } = await generateAssets("creatives");
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  async function handleGenerateLanding() {
    const { message, error: actionError } = await generateAssets("landing");
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  async function handlePrepareCampaign() {
    const { message, error: actionError } = await prepareCampaign();
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  async function handlePerformanceAi() {
    const { message, error: actionError } = await sendToPerformanceAi();
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
    if (actionError) toast.warning(actionError);
  }

  async function handleApprove() {
    if (dashboard?.missingForApproval?.length) {
      toast.error(`Complete antes de aprovar: ${dashboard.missingForApproval.join(", ")}`);
      return;
    }
    const { message, error: actionError, missing } = await approveOperation();
    if (missing.length > 0) {
      toast.error(`Faltam etapas: ${missing.join(", ")}`);
      return;
    }
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
  }

  async function handleCancel() {
    const { message, error: actionError } = await cancelOperation();
    if (actionError && !message) {
      toast.error(actionError);
      return;
    }
    if (message) toast.success(message);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  const progress = dashboard?.progress ?? [];
  const hasOperation = Boolean(dashboard?.operation && dashboard.operation.status !== "cancelled");

  return (
    <div className="space-y-4">
      {(error || backgroundLoading) && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
          {error ?? "Alguns dados ainda estão carregando em segundo plano."}
          {error && (
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-2 underline hover:text-amber-100"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2">
        <Shield className="size-4 shrink-0 text-emerald-400" />
        <p className="text-[11px] text-emerald-200/90">
          {dashboard?.safeMode.message ??
            "Modo seguro — aprovar operação não publica anúncios automaticamente."}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          <RefreshCw className={cn("size-3", busy && "animate-spin")} />
          Atualizar
        </button>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-violet-400" />
            Operação ativa
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          {hasOperation ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[10px] text-zinc-500">Operação</p>
                <p className="text-[13px] font-medium text-zinc-100">{operation!.titulo}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Produto</p>
                <p className="text-[12px] text-zinc-300">{dashboard?.productName ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Status geral</p>
                <span
                  className={cn(
                    "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                    getOperationStatusColor(operation!.status)
                  )}
                >
                  {getOperationStatusLabel(operation!.status)}
                </span>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                <Link href="/dashboard/ceo" className="text-[10px] text-violet-400 hover:underline">
                  Aura CEO →
                </Link>
                <Link href="/dashboard/mission" className="text-[10px] text-cyan-400 hover:underline">
                  Mission Control →
                </Link>
                <Link href="/dashboard/revenue" className="text-[10px] text-emerald-400 hover:underline">
                  Revenue Center →
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Nenhuma operação ativa"
              description="Gere um plano estratégico no Aura CEO para iniciar uma operação executável com criativos, landing e campanha."
              action={
                <Link href="/dashboard/ceo">
                  <ActionButton icon={<Sparkles className="size-3.5" />}>
                    Criar operação no Aura CEO
                  </ActionButton>
                </Link>
              }
            />
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Score operacional"
          value={`${dashboard?.operationalScore ?? 0}/100`}
          hint="Peso por etapa e integrações"
        />
        <MetricCard
          label="Chance de sucesso"
          value={
            dashboard?.successChance != null ? `${dashboard.successChance}%` : "—"
          }
          hint="Estimativa CEO / IA"
        />
        <MetricCard
          label="Meta conectada"
          value={dashboard?.integrations.metaConnected ? "Sim" : "Não"}
          hint="Meta Intelligence"
        />
        <MetricCard
          label="Kiwify conectada"
          value={dashboard?.integrations.kiwifyConnected ? "Sim" : "Não"}
          hint="Kiwify Intelligence"
        />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-4 text-cyan-400" />
            Progresso por etapa
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {progress.length > 0 ? (
            progress.map((step) => (
              <div
                key={step.id}
                className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
              >
                <span className="text-[12px] font-medium text-zinc-200">{step.label}</span>
                <StepBadge status={step.status} />
              </div>
            ))
          ) : (
            <p className="text-[11px] text-zinc-500">Nenhuma etapa em andamento.</p>
          )}
        </PanelContent>
      </Panel>

      {(dashboard?.missingForApproval?.length ?? 0) > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-[11px] font-medium text-amber-200">Alerta antes de aprovar</p>
            <p className="mt-0.5 text-[10px] text-amber-200/80">
              Falta: {dashboard?.missingForApproval?.join(", ")}
            </p>
          </div>
        </div>
      ) : hasOperation && dashboard?.canApprove ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <p className="text-[10px] text-emerald-200/90">
            Operação completa — pode aprovar (status Pronta, sem publicar anúncios).
          </p>
        </div>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-orange-400" />
            Próximos passos
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-1.5">
          {(dashboard?.nextSteps ?? []).length > 0 ? (
            dashboard!.nextSteps.map((step) => (
              <p key={step} className="text-[11px] text-zinc-400">
                • {step}
              </p>
            ))
          ) : (
            <p className="text-[11px] text-zinc-500">Nenhum passo pendente.</p>
          )}
        </PanelContent>
      </Panel>

      {hasOperation && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-pink-400" />
              Ações
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Image className="size-3.5" />}
                onClick={() => void handleGenerateCreatives()}
                disabled={busy || !canMutate}
              >
                Gerar Criativos
              </ActionButton>
              <ActionButton
                icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Layout className="size-3.5" />}
                onClick={() => void handleGenerateLanding()}
                disabled={busy || !canMutate}
              >
                Gerar Landing
              </ActionButton>
              <ActionButton
                icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <Megaphone className="size-3.5" />}
                onClick={() => void handlePrepareCampaign()}
                disabled={busy || !canMutate}
              >
                Montar Campanha
              </ActionButton>
              <ActionButton
                icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <TrendingUp className="size-3.5" />}
                onClick={() => void handlePerformanceAi()}
                disabled={busy || !canMutate}
              >
                Enviar para Performance AI
              </ActionButton>
              <ActionButton
                icon={<CheckCircle2 className="size-3.5 text-emerald-400" />}
                onClick={() => void handleApprove()}
                disabled={busy || !dashboard?.canApprove}
                className="border-emerald-500/30"
              >
                Aprovar Operação
              </ActionButton>
              <ActionButton
                variant="ghost"
                icon={<XCircle className="size-3.5 text-red-400" />}
                onClick={() => void handleCancel()}
                disabled={busy}
              >
                Cancelar Operação
              </ActionButton>
            </div>
          </PanelContent>
        </Panel>
      )}
    </div>
  );
}
