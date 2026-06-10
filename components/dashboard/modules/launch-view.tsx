"use client";

import {
  ArrowDown,
  CheckCircle2,
  Circle,
  Loader2,
  Megaphone,
  Rocket,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvailableBudgetField } from "@/components/dashboard/available-budget-field";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCreator } from "@/hooks/use-creator";
import { useLaunch } from "@/hooks/use-launch";
import type { CreatorLaunchPlan } from "@/types/database";
import { intakeFromProductBundle } from "@/utils/copylab";
import {
  computeChecklistProgress,
  formatBRL,
  getPipelineStageLabel,
} from "@/utils/creator";
import {
  LAUNCH_IA_ACTIONS,
  LAUNCH_PIPELINE_STEPS,
  parseJsonStringArray,
  type LaunchPipelineStep,
} from "@/utils/launch";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

function LaunchPipeline({
  current,
  progress,
}: {
  current: LaunchPipelineStep;
  progress: Record<LaunchPipelineStep, boolean>;
}) {
  const currentIdx = LAUNCH_PIPELINE_STEPS.findIndex((s) => s.id === current);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-center gap-1">
        {LAUNCH_PIPELINE_STEPS.map((step, idx) => {
          const isActive = step.id === current;
          const isDone = progress[step.id];

          return (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium",
                  isActive && "bg-orange-500/20 text-orange-200",
                  isDone && !isActive && "text-emerald-400/90",
                  !isActive && !isDone && "text-zinc-600"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="size-3 shrink-0" />
                ) : (
                  <Circle
                    className={cn("size-3 shrink-0", isActive && "fill-orange-400/30")}
                  />
                )}
                <span className="whitespace-nowrap">{step.label}</span>
              </div>
              {idx < LAUNCH_PIPELINE_STEPS.length - 1 && (
                <ArrowDown className="size-3 rotate-[-90deg] text-zinc-700" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistPanel({
  productId,
  onToggle,
  busy,
}: {
  productId: string;
  onToggle: (itemId: string, status: "pendente" | "feito") => void;
  busy: boolean;
}) {
  const { bundles } = useCreator();
  const bundle = bundles.find((b) => b.product.id === productId);
  if (!bundle) return null;

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

function PlanDisplay({ plan }: { plan: CreatorLaunchPlan }) {
  const tarefas = parseJsonStringArray(plan.tarefas);
  const prioridades = parseJsonStringArray(plan.prioridades);
  const cronograma = Array.isArray(plan.cronograma)
    ? (plan.cronograma as { semana: number; foco: string; tarefas: string[] }[])
    : [];

  return (
    <div className="space-y-3 text-[12px]">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Score IA</p>
          <p className="font-medium text-zinc-200">{plan.score_ia ?? "—"}/100</p>
        </div>
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Receita estimada</p>
          <p className="font-medium text-emerald-300">
            {plan.receita_estimada != null ? formatBRL(plan.receita_estimada) : "—"}
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Data prevista</p>
          <p className="font-medium text-zinc-200">
            {plan.data_prevista_lancamento ?? "—"}
          </p>
        </div>
      </div>

      {prioridades.length > 0 && (
        <div className="rounded-md border border-orange-500/15 bg-orange-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium text-orange-300">Prioridades</p>
          <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-zinc-300">
            {prioridades.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {tarefas.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Tarefas imediatas</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
            {tarefas.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {cronograma.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-zinc-500">Cronograma</p>
          {cronograma.map((w) => (
            <div
              key={w.semana}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
            >
              <p className="text-[11px] font-medium text-zinc-200">
                Semana {w.semana} — {w.foco}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
                {(w.tarefas ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LaunchView() {
  const { toggleChecklistItem, busy: creatorBusy } = useCreator();
  const {
    dashboard,
    center,
    plans,
    loading,
    error,
    busy,
    refresh,
    startLaunch,
    removePlan,
  } = useLaunch();

  const [activePlan, setActivePlan] = useState<CreatorLaunchPlan | null>(null);
  const [orcamentoDisponivel, setOrcamentoDisponivel] = useState<number | null>(null);

  useEffect(() => {
    const plan = activePlan ?? center?.plan ?? null;
    if (plan?.orcamento_disponivel != null && Number(plan.orcamento_disponivel) > 0) {
      setOrcamentoDisponivel(Number(plan.orcamento_disponivel));
    }
  }, [activePlan, center?.plan]);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Launch Center — unifico Research, Creator e CopyLab no seu fluxo de lançamento.",
    },
  ]);

  async function handleStartLaunch() {
    const productId = center?.bundle?.product.id;
    if (!orcamentoDisponivel || orcamentoDisponivel <= 0) {
      toast.error("Informe seu Orçamento disponível.");
      return;
    }
    const { plan, error: startError } = await startLaunch(productId, orcamentoDisponivel);
    if (startError || !plan) {
      toast.error(startError ?? "Erro ao iniciar lançamento.");
      return;
    }
    setActivePlan(plan);
    toast.success("Plano de lançamento criado com IA!");
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
          module: "launch",
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
            onClick={() => void refresh()}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  const bundle = center?.bundle;
  const copyHref = bundle
    ? `/dashboard/creator/copy?${new URLSearchParams({
        product_id: bundle.product.id,
        ...Object.fromEntries(
          Object.entries(intakeFromProductBundle(bundle))
            .filter(([k, v]) => k !== "product_id" && v != null && v !== "")
            .map(([k, v]) => [k, String(v)])
        ),
      }).toString()}`
    : "/dashboard/creator/copy";

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Produto atual"
          value={dashboard?.produtoAtual ?? "—"}
          hint="Foco do lançamento"
        />
        <MetricCard
          label="Estágio"
          value={dashboard?.estagio ?? "—"}
          hint="Pipeline Launch"
        />
        <MetricCard
          label="Score IA"
          value={String(dashboard?.scoreIa ?? 0)}
          hint="Validação 0–100"
        />
        <MetricCard
          label="Receita estimada"
          value={formatBRL(dashboard?.receitaEstimada ?? 0)}
          hint="Potencial do produto"
        />
        <MetricCard
          label="Data prevista"
          value={dashboard?.dataPrevista ?? "—"}
          hint="Lançamento"
        />
        <MetricCard
          label="Checklist"
          value={`${dashboard?.checklistPercent ?? 0}%`}
          hint="Estágio atual"
        />
      </div>

      <Panel className="border-orange-500/15">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Rocket className="size-3.5 text-orange-400" />
            Pipeline de lançamento
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          {center ? (
            <LaunchPipeline
              current={center.pipelineStep}
              progress={center.pipelineProgress}
            />
          ) : (
            <EmptyState
              title="Pipeline vazio"
              description="Crie um produto no Creator para iniciar o fluxo."
            />
          )}

          <AvailableBudgetField
            scope="launch"
            entityId={activePlan?.id ?? null}
            value={orcamentoDisponivel}
            onChange={setOrcamentoDisponivel}
            persistOnBlur={Boolean(activePlan?.id)}
          />

          <div className="flex flex-wrap gap-2">
            <ActionButton
              disabled={busy || !bundle}
              icon={
                busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Rocket className="size-3.5" />
                )
              }
              onClick={() => void handleStartLaunch()}
            >
              Iniciar Lançamento
            </ActionButton>
            <Link href="/dashboard/creator/research">
              <ActionButton variant="ghost" icon={<Search className="size-3.5" />}>
                Research
              </ActionButton>
            </Link>
            <Link href="/dashboard/creator">
              <ActionButton variant="ghost" icon={<Target className="size-3.5" />}>
                Creator
              </ActionButton>
            </Link>
            <Link href={copyHref}>
              <ActionButton variant="ghost" icon={<Megaphone className="size-3.5" />}>
                CopyLab
              </ActionButton>
            </Link>
          </div>
        </PanelContent>
      </Panel>

      {bundle && (
        <Panel className="border-orange-500/20 bg-orange-500/[0.02]">
          <PanelHeader>
            <PanelTitle>{bundle.product.nome ?? "Produto em lançamento"}</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <div className="grid gap-2 text-[12px] sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Estágio Creator</p>
                <p className="text-zinc-300">{getPipelineStageLabel(bundle.product.status)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Research</p>
                <p className="text-zinc-300">
                  {center?.research ? center.research.nicho ?? "Vinculado" : "Pendente"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">CopyLab</p>
                <p className="text-zinc-300">
                  {center?.copy ? center.copy.headline?.slice(0, 50) ?? "Gerada" : "Pendente"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Lançamento</p>
                <p className="text-zinc-300">{bundle.launch?.status ?? "Não iniciado"}</p>
              </div>
            </div>

            <ChecklistPanel
              productId={bundle.product.id}
              busy={creatorBusy || busy}
              onToggle={(itemId, status) =>
                void toggleChecklistItem(itemId, status).then((r) => {
                  if (r.error) toast.error(r.error);
                  else void refresh();
                })
              }
            />
          </PanelContent>
        </Panel>
      )}

      {(activePlan || center?.plan) && (
        <Panel className="border-orange-500/20">
          <PanelHeader>
            <PanelTitle>
              {(activePlan ?? center?.plan)?.titulo ?? "Plano de lançamento"}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <PlanDisplay plan={(activePlan ?? center?.plan)!} />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Histórico de planos</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {plans.length === 0 ? (
            <EmptyState
              title="Nenhum plano ainda"
              description='Clique em "Iniciar Lançamento" para a IA criar tarefas e cronograma.'
            />
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => setActivePlan(plan)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[12px] font-medium text-zinc-200">
                    {plan.titulo ?? "Plano"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {plan.estagio_atual ?? "—"} ·{" "}
                    {plan.data_prevista_lancamento ?? "sem data"}
                  </p>
                </button>
                <ActionButton
                  variant="ghost"
                  disabled={busy}
                  icon={<Trash2 className="size-3.5" />}
                  onClick={() =>
                    void removePlan(plan.id).then((r) => {
                      if (r.error) toast.error(r.error);
                      else {
                        if (activePlan?.id === plan.id) setActivePlan(null);
                        toast.success("Plano removido.");
                      }
                    })
                  }
                >
                  Excluir
                </ActionButton>
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-orange-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-orange-400" />
            Launch Center · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {LAUNCH_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-orange-500/30 hover:text-orange-300 disabled:opacity-50"
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
                  m.role === "user" ? "text-orange-200" : "text-zinc-400"
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
              placeholder="Qual meu próximo passo? O que falta para lançar?"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-orange-500/40"
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
