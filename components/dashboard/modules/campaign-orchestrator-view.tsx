"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  DollarSign,
  Layers,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvailableBudgetField } from "@/components/dashboard/available-budget-field";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCampaignOrchestrator } from "@/hooks/use-campaign-orchestrator";
import { useCreator } from "@/hooks/use-creator";
import type { CreatorCampaignOrchestration } from "@/types/database";
import {
  formatBRL,
  getStepStatusLabel,
  ORCHESTRATOR_IA_ACTIONS,
  ORCHESTRATOR_STEP_LINKS,
  ORCHESTRATOR_STEPS,
  parseOrchestratorLaunchPlan,
  parseOrchestratorRisks,
  type OrchestratorStep,
  type OrchestratorStepStatus,
} from "@/utils/campaign-orchestrator";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

function StepStatusIcon({ status }: { status: OrchestratorStepStatus }) {
  if (status === "concluido") return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />;
  if (status === "bloqueado") return <Ban className="size-3.5 shrink-0 text-zinc-600" />;
  return <Circle className="size-3.5 shrink-0 text-amber-400/70" />;
}

function ChecklistPanel({
  checklist,
}: {
  checklist: Record<OrchestratorStep, OrchestratorStepStatus>;
}) {
  return (
    <div className="space-y-2">
      {ORCHESTRATOR_STEPS.map((step) => {
        const status = checklist[step.id];
        return (
          <div
            key={step.id}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
              status === "concluido" && "border-emerald-500/20 bg-emerald-500/[0.04]",
              status === "pendente" && "border-amber-500/15 bg-amber-500/[0.03]",
              status === "bloqueado" && "border-white/[0.04] bg-white/[0.01] opacity-60"
            )}
          >
            <div className="flex items-center gap-2">
              <StepStatusIcon status={status} />
              <span className="text-[12px] font-medium text-zinc-200">{step.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  status === "concluido" && "bg-emerald-500/20 text-emerald-300",
                  status === "pendente" && "bg-amber-500/20 text-amber-300",
                  status === "bloqueado" && "bg-zinc-700/40 text-zinc-500"
                )}
              >
                {getStepStatusLabel(status)}
              </span>
              {status !== "bloqueado" && (
                <Link
                  href={ORCHESTRATOR_STEP_LINKS[step.id]}
                  className="text-[10px] text-violet-400 hover:underline"
                >
                  Abrir →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrchestrationDetail({
  record,
  onDelete,
  busy,
}: {
  record: CreatorCampaignOrchestration;
  onDelete: () => void;
  busy: boolean;
}) {
  const plan = parseOrchestratorLaunchPlan(record.plano_lancamento);
  const riscos = parseOrchestratorRisks(record.riscos);
  const orcamento = record.orcamento_sugerido as {
    nivel?: string;
    diario_min?: number;
    diario_max?: number;
    mensal?: number;
    justificativa?: string;
  } | null;

  return (
    <div className="space-y-4 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
          Estrutura preparada — não publicada
        </span>
        {record.asset_id && (
          <Link href="/dashboard/creator/studio" className="text-[10px] text-amber-400 hover:underline">
            Criativo conectado →
          </Link>
        )}
        {record.landing_id && (
          <Link href="/dashboard/creator/landing" className="text-[10px] text-sky-400 hover:underline">
            Landing conectada →
          </Link>
        )}
        {record.ads_campaign_id && (
          <Link href="/dashboard/creator/ads" className="text-[10px] text-rose-400 hover:underline">
            Campanha conectada →
          </Link>
        )}
      </div>

      {record.resumo && (
        <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">
            {record.resumo}
          </p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Score do lançamento</p>
          <p className="font-medium text-zinc-200">{record.score_lancamento ?? "—"}/100</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-zinc-500">Probabilidade de sucesso</p>
          <p className="font-medium text-emerald-300">{record.probabilidade_sucesso ?? "—"}%</p>
        </div>
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] text-emerald-400/80">Investimento necessário</p>
          <p className="font-medium text-emerald-200">
            {record.investimento_necessario != null
              ? formatBRL(record.investimento_necessario)
              : "—"}
          </p>
        </div>
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[10px] text-emerald-400/80">Receita prevista</p>
          <p className="font-medium text-emerald-200">
            {record.receita_prevista != null ? formatBRL(record.receita_prevista) : "—"}
          </p>
        </div>
      </div>

      {record.roi_estimado != null && (
        <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="text-[10px] text-violet-400/80">ROI estimado</p>
          <p className="text-[14px] font-semibold text-violet-200">{record.roi_estimado}%</p>
        </div>
      )}

      {orcamento?.mensal != null && (
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Orçamento sugerido · {orcamento.nivel ?? "—"}
          </p>
          <p className="text-[11px] text-zinc-300">
            {orcamento.diario_min != null && orcamento.diario_max != null
              ? `${formatBRL(orcamento.diario_min)} – ${formatBRL(orcamento.diario_max)}/dia`
              : "—"}
            {orcamento.mensal != null ? ` · ${formatBRL(orcamento.mensal)}/mês` : ""}
          </p>
          {orcamento.justificativa && (
            <p className="mt-1 text-[10px] text-zinc-500">{orcamento.justificativa}</p>
          )}
        </div>
      )}

      {plan && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Plano de lançamento · {plan.titulo}
          </p>
          {plan.prioridades?.length > 0 && (
            <ol className="mb-2 list-inside list-decimal space-y-0.5 text-[11px] text-zinc-400">
              {plan.prioridades.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          )}
          {plan.fases?.length > 0 && (
            <div className="space-y-2">
              {plan.fases.map((fase, i) => (
                <div
                  key={i}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <p className="font-medium text-zinc-200">
                    {fase.nome} · {fase.duracao_dias} dias
                  </p>
                  <ul className="mt-1 list-inside list-disc text-[10px] text-zinc-500">
                    {fase.acoes?.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {riscos.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <AlertTriangle className="size-3" />
            Riscos identificados
          </p>
          <div className="space-y-2">
            {riscos.map((r, i) => (
              <div key={i} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    r.nivel === "alto" && "bg-rose-500/20 text-rose-300",
                    r.nivel === "medio" && "bg-amber-500/20 text-amber-300",
                    r.nivel === "baixo" && "bg-emerald-500/20 text-emerald-300"
                  )}
                >
                  {r.nivel}
                </span>
                <p className="mt-1 text-[11px] text-zinc-300">{r.descricao}</p>
                <p className="mt-1 text-[10px] text-zinc-500">Mitigação: {r.mitigacao}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ActionButton
        variant="ghost"
        disabled={busy}
        icon={<Trash2 className="size-3.5" />}
        onClick={onDelete}
      >
        Excluir orquestração
      </ActionButton>
    </div>
  );
}

export function CampaignOrchestratorView() {
  const searchParams = useSearchParams();
  const { bundles } = useCreator();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const {
    dashboard,
    center,
    records,
    loading,
    error,
    busy,
    refresh,
    prepare,
    removeRecord,
  } = useCampaignOrchestrator(selectedProductId);

  const [activeRecord, setActiveRecord] = useState<CreatorCampaignOrchestration | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState<number | null>(null);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Campaign Orchestrator — preparo a estrutura completa do lançamento. Nada é publicado automaticamente.",
    },
  ]);

  useEffect(() => {
    const productId = searchParams.get("product_id");
    if (productId) setSelectedProductId(productId);
    else if (bundles.length > 0 && !selectedProductId) {
      setSelectedProductId(bundles[0]!.product.id);
    }
  }, [searchParams, bundles, selectedProductId]);

  useEffect(() => {
    if (center?.orchestration) {
      setActiveRecord(center.orchestration);
      if (center.orchestration.orcamento_disponivel != null) {
        setOrcamentoDisponivel(Number(center.orchestration.orcamento_disponivel));
      }
    }
  }, [center?.orchestration]);

  async function handlePrepare() {
    if (!selectedProductId) {
      toast.error("Selecione um produto.");
      return;
    }
    if (!orcamentoDisponivel || orcamentoDisponivel <= 0) {
      toast.error("Informe seu Orçamento disponível.");
      return;
    }

    const { orchestration, error: prepError } = await prepare({
      product_id: selectedProductId,
      orchestration_id: activeRecord?.id ?? null,
      orcamento_disponivel: orcamentoDisponivel,
    });

    if (prepError || !orchestration) {
      toast.error(prepError ?? "Erro ao preparar lançamento.");
      return;
    }

    setActiveRecord(orchestration);
    toast.success("Lançamento preparado! Estrutura conectada.");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const history = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/creator-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          module: "orchestrator",
          ...(actionId ? { actionId } : {}),
        }),
      });
      const { data: body, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || body?.error) {
        setIaMessages((c) => [
          ...c,
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [...c, { role: "assistant", text: "Erro de conexão." }]);
    } finally {
      setIaLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
        <PanelContent className="py-4 text-center text-[12px] text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void refresh(selectedProductId)}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  const productOptions = bundles.length > 0 ? bundles : [];
  const checklist = center?.checklist;

  return (
    <div className="space-y-3">
      <Panel className="border-violet-500/15 bg-violet-500/[0.03]">
        <PanelContent className="py-2.5 text-[11px] text-violet-200/90">
          Modo <strong>apenas preparação</strong> — conecta criativos, landing e anúncios em
          rascunho. Nada é publicado automaticamente.
        </PanelContent>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Score do lançamento"
          value={`${dashboard?.scoreLancamento ?? 0}/100`}
          hint="Prontidão geral"
        />
        <MetricCard
          label="Probabilidade de sucesso"
          value={`${dashboard?.probabilidadeSucesso ?? 0}%`}
          hint="Estimativa IA"
        />
        <MetricCard
          label="Investimento necessário"
          value={
            dashboard?.investimentoNecessario
              ? formatBRL(dashboard.investimentoNecessario)
              : "—"
          }
          hint="Orçamento sugerido"
        />
        <MetricCard
          label="Receita prevista"
          value={
            dashboard?.receitaPrevista ? formatBRL(dashboard.receitaPrevista) : "—"
          }
          hint={
            dashboard?.roiEstimado
              ? `ROI ${dashboard.roiEstimado}%`
              : "Projeção IA"
          }
        />
      </div>

      <Panel className="border-violet-500/15">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Target className="size-3.5 text-violet-400" />
            Selecionar produto
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          {productOptions.length === 0 ? (
            <EmptyState
              title="Nenhum produto"
              description="Crie um produto no Creator para orquestrar o lançamento."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {productOptions.map((b) => (
                  <button
                    key={b.product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(b.product.id);
                      void refresh(b.product.id);
                    }}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[11px] transition-colors",
                      selectedProductId === b.product.id
                        ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                        : "border-white/[0.06] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300"
                    )}
                  >
                    {b.product.nome?.slice(0, 35) ?? "Produto"}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500">
                A IA verifica Research, Creator, CopyLab, Creative Studio, Landing Builder e Ads
                Manager para este produto.
              </p>
            </>
          )}
        </PanelContent>
      </Panel>

      {checklist && selectedProductId && (
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Layers className="size-3.5" />
              Checklist de lançamento
              <span className="text-[10px] font-normal text-zinc-500">
                {dashboard?.etapasConcluidas ?? 0}/{dashboard?.etapasTotal ?? 6} concluídas
              </span>
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <ChecklistPanel checklist={checklist} />
          </PanelContent>
        </Panel>
      )}

      {selectedProductId && (
        <Panel className="border-violet-500/15">
          <PanelContent className="pt-3">
            <AvailableBudgetField
              scope="orchestration"
              entityId={activeRecord?.id ?? null}
              value={orcamentoDisponivel}
              onChange={setOrcamentoDisponivel}
              persistOnBlur={Boolean(activeRecord?.id)}
            />
          </PanelContent>
        </Panel>
      )}

      {selectedProductId && (
        <div className="flex flex-wrap gap-2">
          <ActionButton
            disabled={busy}
            icon={
              busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Rocket className="size-3.5" />
              )
            }
            onClick={() => void handlePrepare()}
          >
            Preparar Lançamento
          </ActionButton>
        </div>
      )}

      {activeRecord && (
        <Panel className="border-violet-500/20 bg-violet-500/[0.02]">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-violet-400" />
              Campanha preparada
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <OrchestrationDetail
              record={activeRecord}
              busy={busy}
              onDelete={() =>
                void removeRecord(activeRecord.id).then((r) => {
                  if (r.error) toast.error(r.error);
                  else {
                    setActiveRecord(null);
                    toast.success("Orquestração removida.");
                  }
                })
              }
            />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <DollarSign className="size-3.5" />
            Histórico de orquestrações
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhuma orquestração ainda"
              description="Selecione um produto e clique em Preparar Lançamento."
            />
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId((id) => (id === record.id ? null : record.id));
                    setActiveRecord(record);
                    if (record.product_id) {
                      setSelectedProductId(record.product_id);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {record.resumo?.slice(0, 60) ?? "Orquestração"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Score {record.score_lancamento ?? "—"} · ROI {record.roi_estimado ?? "—"}% ·{" "}
                      {record.status}
                    </p>
                  </div>
                  <Sparkles
                    className={cn(
                      "size-3.5 shrink-0",
                      record.status === "prepared" ? "text-violet-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <OrchestrationDetail
                      record={record}
                      busy={busy}
                      onDelete={() =>
                        void removeRecord(record.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else {
                            if (activeRecord?.id === record.id) setActiveRecord(null);
                            toast.success("Orquestração removida.");
                          }
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-violet-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Aura Coach
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {ORCHESTRATOR_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.04] bg-black/20 p-2">
            {iaMessages.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "whitespace-pre-wrap text-[11px]",
                  m.role === "user" ? "text-violet-200" : "text-zinc-400"
                )}
              >
                {m.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="O que falta para lançar? Meu produto está pronto?"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
            />
            <ActionButton
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              icon={
                iaLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )
              }
            >
              Enviar
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
