"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Rocket,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import type { CreatorPipelineStage } from "@/types/database";
import {
  computeChecklistProgress,
  CREATOR_IA_ACTIONS,
  CREATOR_NICHE_SUGGESTIONS,
  CREATOR_PIPELINE_STAGES,
  formatBRL,
  formatPercent,
  getNextPipelineStage,
  getPipelineStageLabel,
  parseBulletPoints,
  type CreatorProductBundle,
  type CreatorProductIntake,
  type GeneratedCreatorPlan,
} from "@/utils/creator";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

type WizardStep = "idle" | "intake" | "product" | "validation" | "offer";

const EMPTY_INTAKE: CreatorProductIntake = {
  nicho: "",
  conhecimento: "",
  publico_alvo: "",
  objetivo_financeiro: null,
  prazo: "",
};

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-zinc-200">{value ?? "—"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-violet-400 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
        />
      </div>
    </div>
  );
}

function PipelineStepper({ current }: { current: CreatorPipelineStage }) {
  const currentIdx = CREATOR_PIPELINE_STAGES.findIndex((s) => s.id === current);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1">
        {CREATOR_PIPELINE_STAGES.map((stage, idx) => {
          const isActive = stage.id === current;
          const isDone = idx < currentIdx;
          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px]",
                isActive && "bg-violet-500/20 text-violet-200",
                isDone && !isActive && "text-emerald-400/80",
                !isActive && !isDone && "text-zinc-600"
              )}
            >
              {isDone ? (
                <CheckCircle2 className="size-3 shrink-0" />
              ) : (
                <Circle className={cn("size-3 shrink-0", isActive && "fill-violet-400/30")} />
              )}
              <span className="whitespace-nowrap">{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistPanel({
  bundle,
  onToggle,
  busy,
}: {
  bundle: CreatorProductBundle;
  onToggle: (itemId: string, status: "pendente" | "feito") => void;
  busy: boolean;
}) {
  const stage = bundle.product.status;
  const items = bundle.checklist.filter((i) => i.estagio === stage);
  const progress = computeChecklistProgress(bundle.checklist, stage);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-zinc-300">
          Checklist · {getPipelineStageLabel(stage)}
        </p>
        <span className="text-[10px] text-zinc-500">
          {progress.done}/{progress.total} ({progress.percent}%)
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onToggle(item.id, item.status === "feito" ? "pendente" : "feito")
              }
              className="flex w-full items-start gap-2 text-left disabled:opacity-50"
            >
              {item.status === "feito" ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="mt-0.5 size-3.5 shrink-0 text-zinc-600" />
              )}
              <span
                className={cn(
                  "text-[11px]",
                  item.status === "feito" ? "text-zinc-500 line-through" : "text-zinc-300"
                )}
              >
                {item.titulo}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanDisplay({ plan }: { plan: GeneratedCreatorPlan }) {
  return (
    <div className="space-y-2 rounded-md border border-blue-500/15 bg-blue-500/[0.04] p-3">
      <p className="text-[11px] font-medium text-blue-300">{plan.titulo}</p>
      {plan.semanas.map((w) => (
        <div key={w.semana}>
          <p className="text-[11px] font-medium text-zinc-200">
            Semana {w.semana} — {w.foco}
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
            {w.tarefas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProductDetail({
  bundle,
  onToggleChecklist,
  busy,
}: {
  bundle: CreatorProductBundle;
  onToggleChecklist?: (itemId: string, status: "pendente" | "feito") => void;
  busy?: boolean;
}) {
  const { product, validation, offer } = bundle;
  const bullets = parseBulletPoints(offer?.bullet_points);

  return (
    <div className="space-y-3 text-[12px]">
      <PipelineStepper current={product.status} />

      {onToggleChecklist && (
        <ChecklistPanel bundle={bundle} onToggle={onToggleChecklist} busy={busy ?? false} />
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Problema</p>
          <p className="text-zinc-300">{product.problema ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Solução</p>
          <p className="text-zinc-300">{product.solucao ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Avatar</p>
          <p className="text-zinc-300">{product.avatar ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Público-alvo</p>
          <p className="text-zinc-300">{product.publico_alvo ?? "—"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-md border border-amber-500/10 bg-amber-500/[0.03] p-2.5 text-[11px] text-zinc-400">
        <span>Investimento: {formatBRL(product.investimento_previsto)}</span>
        <span>Receita prevista: {formatBRL(product.receita_prevista)}</span>
        <span>ROI: {formatPercent(product.roi_estimado)}</span>
        <span>
          Preço: {formatBRL(product.faixa_preco_min)} – {formatBRL(product.faixa_preco_max)}
        </span>
      </div>

      {validation && (
        <div className="space-y-2 rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="text-[11px] font-medium text-violet-300">
            Score IA · Nota {validation.nota_final}/100
          </p>
          <ScoreBar label="Viabilidade" value={validation.viabilidade} />
          <ScoreBar label="Lucro potencial" value={validation.lucro_potencial} />
          <ScoreBar label="Tempo para lançar" value={validation.tempo_lancar} />
          <ScoreBar label="Compatibilidade com perfil" value={validation.compatibilidade_perfil} />
          <ScoreBar label="Escalabilidade" value={validation.escalabilidade} />
        </div>
      )}

      {offer && (
        <div className="space-y-2 rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="text-[13px] font-semibold text-zinc-100">{offer.headline}</p>
          {offer.subheadline && (
            <p className="text-[12px] text-zinc-400">{offer.subheadline}</p>
          )}
          {bullets.length > 0 && (
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-300">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CreatorView() {
  const {
    dashboard,
    bundles,
    loading,
    error,
    busy,
    refresh,
    generateProduct,
    validateProduct,
    generateOffer,
    advanceStage,
    toggleChecklistItem,
    generatePlan,
    removeProduct,
  } = useCreator();

  const [step, setStep] = useState<WizardStep>("idle");
  const [intake, setIntake] = useState<CreatorProductIntake>(EMPTY_INTAKE);
  const [activeBundle, setActiveBundle] = useState<CreatorProductBundle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeneratedCreatorPlan | null>(null);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Creator — transformo ideias em projetos executáveis com pipeline completo, checklist e scores IA.",
    },
  ]);

  async function handleGenerate(useAuraData: boolean) {
    const { bundle, error: genError } = await generateProduct({ intake, useAuraData });
    if (genError || !bundle) {
      toast.error(genError ?? "Erro ao gerar produto.");
      return;
    }
    setActiveBundle(bundle);
    setStep("product");
    setPlan(null);
    toast.success("Produto gerado · checklist criado automaticamente.");
  }

  async function handleValidate() {
    if (!activeBundle) return;
    const { bundle, error: valError } = await validateProduct(activeBundle.product.id);
    if (valError || !bundle) {
      toast.error(valError ?? "Erro na validação.");
      return;
    }
    setActiveBundle(bundle);
    setStep("validation");
    toast.success(`Validação concluída · ${bundle.validation?.nota_final}/100`);
  }

  async function handleOffer() {
    if (!activeBundle) return;
    const { bundle, error: offerError } = await generateOffer(activeBundle.product.id);
    if (offerError || !bundle) {
      toast.error(offerError ?? "Erro ao gerar oferta.");
      return;
    }
    setActiveBundle(bundle);
    setStep("offer");
    toast.success("Oferta gerada · estágio Página de vendas.");
  }

  async function handleAdvance() {
    if (!activeBundle) return;
    const { bundle, error: advError } = await advanceStage(activeBundle.product.id);
    if (advError || !bundle) {
      toast.error(advError ?? "Erro ao avançar.");
      return;
    }
    setActiveBundle(bundle);
    toast.success(`Avançou para ${getPipelineStageLabel(bundle.product.status)}`);
  }

  async function handleToggleChecklist(itemId: string, status: "pendente" | "feito") {
    const { bundle, error: toggleError } = await toggleChecklistItem(itemId, status);
    if (toggleError) {
      toast.error(toggleError);
      return;
    }
    if (bundle && activeBundle?.product.id === bundle.product.id) {
      setActiveBundle(bundle);
    }
  }

  async function handlePlan() {
    if (!activeBundle) return;
    const { plan: newPlan, error: planError } = await generatePlan(activeBundle.product.id);
    if (planError || !newPlan) {
      toast.error(planError ?? "Erro ao gerar plano.");
      return;
    }
    setPlan(newPlan);
    toast.success("Plano de 30 dias gerado.");
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
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA Creator." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: "Erro de conexão com a IA Creator." },
      ]);
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
            onClick={() => void refresh()}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  const nextStage = activeBundle ? getNextPipelineStage(activeBundle.product.status) : null;
  const stageProgress = activeBundle
    ? computeChecklistProgress(activeBundle.checklist, activeBundle.product.status)
    : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Produtos criados"
          value={String(dashboard?.produtosCriados ?? 0)}
          hint="Total no pipeline"
        />
        <MetricCard
          label="Validados (score IA)"
          value={String(dashboard?.produtosValidados ?? 0)}
          hint="Com análise estratégica"
        />
        <MetricCard
          label="Em produção"
          value={String(dashboard?.emProducao ?? 0)}
          hint="Produção → Lançamento"
        />
        <MetricCard
          label="Melhor oportunidade"
          value={dashboard?.melhorOportunidade ?? "—"}
          hint="Maior nota IA"
        />
        <MetricCard
          label="Potencial estimado"
          value={formatBRL(dashboard?.potencialEstimado ?? 0)}
          hint="Receita prevista total"
        />
        <MetricCard
          label="ROI médio"
          value={formatPercent(dashboard?.roiMedio ?? 0)}
          hint="Retorno estimado"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => {
            setStep("intake");
            setIntake(EMPTY_INTAKE);
            setActiveBundle(null);
            setPlan(null);
          }}
        >
          Criar Produto
        </ActionButton>
        {step !== "idle" && (
          <ActionButton
            variant="ghost"
            onClick={() => {
              setStep("idle");
              setActiveBundle(null);
              setPlan(null);
            }}
          >
            Fechar assistente
          </ActionButton>
        )}
      </div>

      {step === "intake" && (
        <Panel className="border-violet-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Wand2 className="size-3.5 text-violet-400" />
              Novo produto digital
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              Pipeline completo: Ideia → Pesquisa → Validação → Produção → Página de vendas →
              Criativos → Lançamento → Tráfego → Escala
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["nicho", "Nicho"],
                  ["conhecimento", "Seu conhecimento"],
                  ["publico_alvo", "Público-alvo"],
                  ["prazo", "Prazo"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-[10px] text-zinc-500">{label}</span>
                  <input
                    value={intake[key]}
                    onChange={(e) => setIntake((c) => ({ ...c, [key]: e.target.value }))}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
                  />
                </label>
              ))}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] text-zinc-500">
                  Objetivo financeiro (R$)
                </span>
                <input
                  type="number"
                  min={0}
                  value={intake.objetivo_financeiro ?? ""}
                  onChange={(e) =>
                    setIntake((c) => ({
                      ...c,
                      objetivo_financeiro: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CREATOR_NICHE_SUGGESTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIntake((c) => ({ ...c, nicho: n }))}
                  className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-violet-500/30 hover:text-violet-300"
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton
                disabled={busy}
                icon={
                  busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )
                }
                onClick={() => void handleGenerate(false)}
              >
                Gerar com IA
              </ActionButton>
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={() => void handleGenerate(true)}
              >
                Use meus dados da Aura
              </ActionButton>
            </div>
          </PanelContent>
        </Panel>
      )}

      {activeBundle && step !== "idle" && step !== "intake" && (
        <Panel className="border-violet-500/20 bg-violet-500/[0.02]">
          <PanelHeader className="items-start">
            <div>
              <PanelTitle>{activeBundle.product.nome ?? "Produto"}</PanelTitle>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {getPipelineStageLabel(activeBundle.product.status)}
                {stageProgress && stageProgress.total > 0
                  ? ` · checklist ${stageProgress.percent}%`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(step === "product" || activeBundle.product.status === "pesquisa") &&
                !activeBundle.validation && (
                  <ActionButton
                    disabled={busy}
                    icon={
                      busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Target className="size-3.5" />
                      )
                    }
                    onClick={() => void handleValidate()}
                  >
                    Validar com IA
                  </ActionButton>
                )}
              {activeBundle.validation && !activeBundle.offer && (
                <ActionButton
                  disabled={busy}
                  icon={
                    busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Rocket className="size-3.5" />
                    )
                  }
                  onClick={() => void handleOffer()}
                >
                  Gerar oferta
                </ActionButton>
              )}
              {nextStage && (
                <ActionButton
                  variant="ghost"
                  disabled={busy}
                  icon={
                    busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="size-3.5" />
                    )
                  }
                  onClick={() => void handleAdvance()}
                >
                  Avançar → {getPipelineStageLabel(nextStage)}
                </ActionButton>
              )}
              <ActionButton
                variant="ghost"
                disabled={busy}
                icon={
                  busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CalendarDays className="size-3.5" />
                  )
                }
                onClick={() => void handlePlan()}
              >
                Plano 30 dias
              </ActionButton>
            </div>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <ProductDetail
              bundle={activeBundle}
              onToggleChecklist={handleToggleChecklist}
              busy={busy}
            />
            {plan && <PlanDisplay plan={plan} />}
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Produtos</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {bundles.length === 0 ? (
            <EmptyState
              title="Nenhum produto ainda"
              description='Clique em "Criar Produto" para iniciar o pipeline.'
            />
          ) : (
            bundles.map((bundle) => (
              <div
                key={bundle.product.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((id) =>
                      id === bundle.product.id ? null : bundle.product.id
                    )
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {bundle.product.nome ?? "Sem nome"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {getPipelineStageLabel(bundle.product.status)}
                      {bundle.validation ? ` · ${bundle.validation.nota_final}/100` : ""}
                      {bundle.product.roi_estimado != null
                        ? ` · ROI ${bundle.product.roi_estimado}%`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBundle(bundle);
                        setStep("product");
                        setPlan(null);
                      }}
                      className="rounded p-1 text-zinc-600 hover:bg-violet-500/10 hover:text-violet-400"
                      aria-label="Abrir produto"
                    >
                      <Wand2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeProduct(bundle.product.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else toast.success("Produto removido.");
                        });
                      }}
                      className="rounded p-1 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label="Excluir produto"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <TrendingUp
                      className={cn(
                        "size-3.5 shrink-0",
                        bundle.validation && bundle.validation.nota_final >= 70
                          ? "text-emerald-400"
                          : "text-zinc-600"
                      )}
                    />
                  </div>
                </button>
                {expandedId === bundle.product.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <ProductDetail
                      bundle={bundle}
                      onToggleChecklist={handleToggleChecklist}
                      busy={busy}
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
            Aura Creator · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {CREATOR_IA_ACTIONS.map((action) => (
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
              placeholder="Qual produto devo lançar? Maior chance de venda? Plano de 30 dias..."
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
