"use client";

import {
  Bot,
  Check,
  Copy,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAutopilot } from "@/hooks/use-autopilot";
import type { CreatorAdsCampaign } from "@/types/database";
import {
  AUTOPILOT_CONTROL_LEVELS,
  AUTOPILOT_RULE_LABELS,
  getActionTypeLabel,
  parseCampaignMetrics,
  type AutopilotRuleKey,
  type ManualActionType,
} from "@/utils/autopilot";
import { cn } from "@/utils/cn";

const BTN_SM = "!h-7 !min-h-7 px-2 text-[11px]";

function CampaignRow({
  campaign,
  monitorMetrics,
  busy,
  onAction,
}: {
  campaign: CreatorAdsCampaign;
  monitorMetrics: ReturnType<typeof parseCampaignMetrics>;
  busy: boolean;
  onAction: (type: ManualActionType) => void;
}) {
  const statusLabel =
    campaign.status === "active"
      ? "Ativa"
      : campaign.status === "paused"
        ? "Pausada"
        : "Rascunho";

  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-zinc-200">
            {campaign.nome ?? campaign.campanha_nome ?? "Campanha"}
          </p>
          <p className="text-[10px] text-zinc-500">{statusLabel}</p>
        </div>
        <Link
          href="/dashboard/creator/ads"
          className="text-[10px] text-violet-400 hover:underline"
        >
          Ads Manager →
        </Link>
      </div>

      {monitorMetrics && (
        <div className="mb-2 grid grid-cols-2 gap-1 text-[10px] text-zinc-400 sm:grid-cols-5">
          <span>CTR {monitorMetrics.ctr}%</span>
          <span>CPA R${monitorMetrics.cpa}</span>
          <span>ROAS {monitorMetrics.roas}x</span>
          <span>Freq {monitorMetrics.frequency}</span>
          <span>Orç. {monitorMetrics.budget_spent_pct}%</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <ActionButton
          className="!h-7 !min-h-7 px-2 text-[11px]"
          disabled={busy}
          onClick={() => onAction("start_campaign")}
        >
          <Play className="size-3" /> Iniciar
        </ActionButton>
        <ActionButton className={BTN_SM} disabled={busy} onClick={() => onAction("pause_campaign")}>
          <Pause className="size-3" /> Pausar
        </ActionButton>
        <ActionButton className={BTN_SM} disabled={busy} onClick={() => onAction("resume_campaign")}>
          <RefreshCw className="size-3" /> Retomar
        </ActionButton>
        <ActionButton className={BTN_SM} disabled={busy} onClick={() => onAction("duplicate_campaign")}>
          <Copy className="size-3" /> Duplicar
        </ActionButton>
        <ActionButton className={BTN_SM} disabled={busy} onClick={() => onAction("generate_creative")}>
          <Sparkles className="size-3" /> Criativo
        </ActionButton>
        <ActionButton className={BTN_SM} disabled={busy} onClick={() => onAction("generate_copy")}>
          <Bot className="size-3" /> Copy
        </ActionButton>
      </div>
    </div>
  );
}

export function AutopilotView() {
  const {
    dashboard,
    settings,
    rules,
    campaigns,
    monitors,
    actions,
    loading,
    error,
    busy,
    updateSettings,
    runManual,
    evaluateRules,
    approveAction,
    rejectAction,
    fixWithAi,
  } = useAutopilot();

  const [iaText, setIaText] = useState<string | null>(null);

  const monitorMap = new Map(monitors.map((m) => [m.campaign_id, m]));
  const pendingActions = actions.filter((a) =>
    ["pending_approval", "suggested"].includes(a.status)
  );

  async function handleManual(campaignId: string, actionType: ManualActionType) {
    const { error: runError } = await runManual(campaignId, actionType);
    if (runError) {
      toast.error(runError);
      return;
    }
    toast.success(`${getActionTypeLabel(actionType)} registrado.`);
  }

  async function handleEvaluate() {
    const { error: evalError, triggered } = await evaluateRules();
    if (evalError) {
      toast.error(evalError);
      return;
    }
    toast.success(`Regras avaliadas — ${triggered ?? 0} acionada(s).`);
  }

  async function handleFix(actionId: string) {
    const { text, error: fixError } = await fixWithAi(
      actionId,
      "Sugira correção prática para este problema detectado."
    );
    if (fixError) {
      toast.error(fixError);
      return;
    }
    setIaText(text);
    toast.success("Sugestão da IA gerada.");
  }

  async function toggleRule(key: AutopilotRuleKey) {
    if (!rules) return;
    const next = {
      ...rules,
      [key]: { ...rules[key], enabled: !rules[key].enabled },
    };
    const { error: saveError } = await updateSettings({ rules: next });
    if (saveError) toast.error(saveError);
    else toast.success("Regra atualizada.");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Autopilot indisponível"
        description={error}
      />
    );
  }

  const displayCampaigns = campaigns;

  return (
    <div className="space-y-3">
      {dashboard && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Campanhas" value={String(dashboard.totalCampaigns)} />
          <MetricCard label="Ativas" value={String(dashboard.activeCampaigns)} />
          <MetricCard label="Pendentes" value={String(dashboard.pendingActions)} />
          <MetricCard label="Regras hoje" value={String(dashboard.rulesTriggeredToday)} />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Nível de controle</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {AUTOPILOT_CONTROL_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                disabled={busy}
                onClick={() => void updateSettings({ control_level: level.id }).then((r) => {
                  if (r.error) toast.error(r.error);
                  else toast.success(`Modo: ${level.label}`);
                })}
                className={cn(
                  "w-full rounded-md border p-2.5 text-left transition-colors",
                  settings?.control_level === level.id
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                )}
              >
                <p className="text-[11px] font-medium text-zinc-200">{level.label}</p>
                <p className="text-[10px] text-zinc-500">{level.description}</p>
              </button>
            ))}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Regras automáticas</PanelTitle>
            <ActionButton className={BTN_SM} disabled={busy} onClick={() => void handleEvaluate()}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Avaliar agora
            </ActionButton>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {rules &&
              (Object.keys(AUTOPILOT_RULE_LABELS) as AutopilotRuleKey[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                >
                  <span className="text-[11px] text-zinc-300">{AUTOPILOT_RULE_LABELS[key]}</span>
                  <input
                    type="checkbox"
                    checked={rules[key].enabled}
                    disabled={busy}
                    onChange={() => void toggleRule(key)}
                    className="size-4 rounded border-white/20"
                  />
                </label>
              ))}
            <p className="text-[10px] text-zinc-600">
              Pausas automáticas só ocorrem com regra ativa e nível &quot;Executar regras aprovadas&quot;.
              Orçamento e publicação sempre exigem aprovação.
            </p>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Campanhas monitoradas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {campaigns.length === 0 ? (
            <EmptyState
              title="Nenhuma campanha"
              description="Crie campanhas no Ads Manager para monitorar com o Autopilot."
              action={
                <Link
                  href="/dashboard/creator/ads"
                  className="text-[12px] text-violet-400 hover:underline"
                >
                  Ir ao Ads Manager
                </Link>
              }
            />
          ) : (
            displayCampaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                monitorMetrics={parseCampaignMetrics(monitorMap.get(campaign.id)?.metrics ?? null)}
                busy={busy}
                onAction={(type) => void handleManual(campaign.id, type)}
              />
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Ações e notificações</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2">
          {pendingActions.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Nenhuma ação pendente.</p>
          ) : (
            pendingActions.map((action) => (
              <div
                key={action.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-zinc-200">
                    {getActionTypeLabel(action.action_type)}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase text-zinc-500">
                    {action.status}
                  </span>
                </div>
                {action.reason && (
                  <p className="text-[10px] text-zinc-400">{action.reason}</p>
                )}
                {action.metric_detected && (
                  <p className="text-[10px] text-amber-400/80">
                    {action.metric_detected}: {action.metric_value}
                  </p>
                )}
                {action.suggestion && (
                  <p className="mt-1 text-[10px] text-zinc-500">{action.suggestion}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {action.status === "pending_approval" && (
                    <>
                      <ActionButton
                        className={BTN_SM}
                        disabled={busy}
                        onClick={() =>
                          void approveAction(action.id).then((r) => {
                            if (r.error) toast.error(r.error);
                            else toast.success("Ação aprovada e executada.");
                          })
                        }
                      >
                        <Check className="size-3" /> Aprovar
                      </ActionButton>
                      <ActionButton
                        className={BTN_SM}
                        disabled={busy}
                        onClick={() =>
                          void rejectAction(action.id).then((r) => {
                            if (r.error) toast.error(r.error);
                            else toast.success("Ação rejeitada.");
                          })
                        }
                      >
                        <X className="size-3" /> Rejeitar
                      </ActionButton>
                    </>
                  )}
                  <ActionButton
                    className={BTN_SM}
                    disabled={busy}
                    onClick={() => void handleFix(action.id)}
                  >
                    <Sparkles className="size-3" /> Corrigir com IA
                  </ActionButton>
                </div>
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      {iaText && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Sugestão da Aura</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">{iaText}</p>
          </PanelContent>
        </Panel>
      )}

      <p className="text-[10px] text-zinc-600">
        Integrações: Ads Manager · Performance AI · Creative Studio · CopyLab · Notificações · Logs · Aura CEO
      </p>
    </div>
  );
}
