"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAuraXp } from "@/hooks/use-aura-xp";
import { useMoney } from "@/hooks/use-money";
import type { MoneyMissionPlan, MoneyMissionTask } from "@/types/database";
import { awardAuraXpClient } from "@/lib/xp/client";
import { cn } from "@/utils/cn";
import { formatBRL } from "@/utils/format";
import {
  getTodayMissions,
  getWeeklyMissions,
  MONEY_IA_ACTIONS,
  MONEY_META_OPTIONS,
  MONEY_PRAZO_OPTIONS,
  MONEY_PRIORIDADE_OPTIONS,
  parseCronograma,
  parseJsonStringArray,
  resolvePrioridadeLabel,
  resolvePrazoLabel,
  type MoneyPrazo,
  type MoneyPrioridade,
} from "@/utils/money";
import { parseJsonResponse } from "@/utils/safe-json";

function MissionItem({
  task,
  busy,
  onComplete,
}: {
  task: MoneyMissionTask;
  busy: boolean;
  onComplete: (id: string) => void;
}) {
  const done = task.status === "completed";

  return (
    <li>
      <button
        type="button"
        disabled={busy || done}
        onClick={() => onComplete(task.id)}
        className="flex w-full items-start gap-2 text-left disabled:opacity-50"
      >
        {done ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
        ) : (
          <Circle className="mt-0.5 size-3.5 shrink-0 text-zinc-600" />
        )}
        <div>
          <span
            className={cn(
              "text-[11px] font-medium",
              done ? "text-zinc-500 line-through" : "text-zinc-300"
            )}
          >
            {task.titulo}
          </span>
          {task.descricao && (
            <p className="text-[10px] text-zinc-500">{task.descricao}</p>
          )}
        </div>
      </button>
    </li>
  );
}

function PlanDisplay({ plan }: { plan: MoneyMissionPlan }) {
  const produtos = parseJsonStringArray(plan.produtos_recomendados);
  const servicos = parseJsonStringArray(plan.servicos_recomendados);
  const riscos = parseJsonStringArray(plan.riscos);
  const cronograma = parseCronograma(plan.cronograma);

  return (
    <div className="space-y-3 text-[12px]">
      {plan.plano_financeiro && (
        <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium text-emerald-300">Plano financeiro</p>
          <p className="whitespace-pre-wrap text-[11px] text-zinc-300">{plan.plano_financeiro}</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Receita estimada</p>
          <p className="font-medium text-emerald-300">
            {plan.receita_estimada != null ? formatBRL(Number(plan.receita_estimada)) : "—"}
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Investimento</p>
          <p className="font-medium text-zinc-200">
            {plan.investimento_necessario != null
              ? formatBRL(Number(plan.investimento_necessario))
              : "—"}
          </p>
        </div>
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">ROI estimado</p>
          <p className="font-medium text-zinc-200">{plan.roi_estimado ?? "—"}%</p>
        </div>
        <div className="rounded-md border border-white/[0.06] p-2">
          <p className="text-[10px] text-zinc-500">Probabilidade</p>
          <p className="font-medium text-zinc-200">{plan.probabilidade_sucesso ?? "—"}%</p>
        </div>
      </div>

      {produtos.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Produtos recomendados</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
            {produtos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {servicos.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Serviços recomendados</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
            {servicos.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {riscos.length > 0 && (
        <div className="rounded-md border border-rose-500/15 bg-rose-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium text-rose-300">Riscos</p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
            {riscos.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {cronograma.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-zinc-500">Cronograma semanal</p>
          {cronograma.map((w) => (
            <div
              key={w.semana}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
            >
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
      )}
    </div>
  );
}

export function MoneyView() {
  const {
    dashboard,
    plan,
    tasks,
    loading,
    error,
    busy,
    refresh,
    startMission,
    completeTask,
    removePlan,
  } = useMoney();
  const { refresh: refreshAuraXp } = useAuraXp();

  const [valorMeta, setValorMeta] = useState<number>(20000);
  const [customMeta, setCustomMeta] = useState("");
  const [prazo, setPrazo] = useState<MoneyPrazo>("90_dias");
  const [prioridade, setPrioridade] = useState<MoneyPrioridade>("crescimento");

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Money Missions — transformo sua meta financeira em um plano executável com todos os módulos da Aura.",
    },
  ]);

  const todayMissions = getTodayMissions(tasks);
  const weeklyMissions = getWeeklyMissions(tasks);

  async function handleStartMission() {
    const meta = customMeta ? Number(customMeta.replace(/\D/g, "")) : valorMeta;
    if (!meta || meta <= 0) {
      toast.error("Informe um valor meta válido.");
      return;
    }

    const { plan: newPlan, error: startError } = await startMission({
      valorMeta: meta,
      prazo,
      prioridade,
    });

    if (startError || !newPlan) {
      toast.error(startError ?? "Erro ao criar plano.");
      return;
    }

    toast.success("Plano financeiro criado com IA!");
  }

  async function handleCompleteTask(taskId: string) {
    const { error: completeError } = await completeTask(taskId);
    if (completeError) {
      toast.error(completeError);
      return;
    }

    await awardAuraXpClient("missao_money_concluir", `money-task:${taskId}`);
    await refreshAuraXp({ silent: true });
    toast.success("Missão concluída! +XP");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const history = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/money/ia", {
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

  if (error && !plan) {
    return (
      <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
        <PanelContent className="py-4 text-center text-[12px] text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            className="ml-2 underline hover:text-rose-200"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {dashboard?.planoAtivo && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Meta financeira"
            value={formatBRL(dashboard.valorMeta)}
            hint={plan ? resolvePrazoLabel(plan.prazo as MoneyPrazo) : ""}
          />
          <MetricCard
            label="Valor conquistado"
            value={formatBRL(dashboard.valorConquistado)}
            hint={`${dashboard.progressoPct}% da meta`}
          />
          <MetricCard
            label="Valor restante"
            value={formatBRL(dashboard.valorRestante)}
            hint={`${dashboard.diasRestantes} dias restantes`}
          />
          <MetricCard
            label="Probabilidade de sucesso"
            value={`${dashboard.probabilidadeSucesso}%`}
            hint={plan ? resolvePrioridadeLabel(plan.prioridade as MoneyPrioridade) : ""}
          />
        </div>
      )}

      {!plan && (
        <Panel className="border-emerald-500/15">
          <PanelHeader>
            <PanelTitle>Missão principal</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-medium text-zinc-400">
                Quanto você quer ganhar?
              </p>
              <div className="flex flex-wrap gap-2">
                {MONEY_META_OPTIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setValorMeta(v);
                      setCustomMeta("");
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[11px] transition-colors",
                      valorMeta === v && !customMeta
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/[0.06] text-zinc-400 hover:border-white/10"
                    )}
                  >
                    {formatBRL(v)}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Outro valor (ex: R$ 15.000)"
                value={customMeta}
                onChange={(e) => setCustomMeta(e.target.value)}
                className="mt-2 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium text-zinc-400">Prazo</p>
              <div className="flex flex-wrap gap-2">
                {MONEY_PRAZO_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPrazo(p.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[11px] transition-colors",
                      prazo === p.id
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/[0.06] text-zinc-400 hover:border-white/10"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium text-zinc-400">Prioridade</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {MONEY_PRIORIDADE_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPrioridade(p.id)}
                    className={cn(
                      "rounded-md border p-3 text-left transition-colors",
                      prioridade === p.id
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/[0.06] hover:border-white/10"
                    )}
                  >
                    <p className="text-[11px] font-medium text-zinc-200">{p.label}</p>
                    <p className="text-[10px] text-zinc-500">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <ActionButton
              onClick={() => void handleStartMission()}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  IA analisando...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Gerar plano com IA
                </>
              )}
            </ActionButton>

            <p className="text-[10px] text-zinc-600">
              A IA analisa Legado, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social
              Media e Alvesz Experience.
            </p>
          </PanelContent>
        </Panel>
      )}

      {plan && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-zinc-200">{dashboard?.tituloPlano}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void removePlan(plan.id).then(({ error: delError }) => {
                  if (delError) toast.error(delError);
                  else toast.success("Plano removido.");
                });
              }}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-rose-400 disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              Excluir
            </button>
          </div>

          <Panel className="border-emerald-500/15">
            <PanelHeader>
              <PanelTitle>Plano gerado pela IA</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <PlanDisplay plan={plan} />
            </PanelContent>
          </Panel>

          {todayMissions.length > 0 && (
            <Panel className="border-emerald-500/15">
              <PanelHeader>
                <PanelTitle>Missões do dia</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <ul className="space-y-2">
                  {todayMissions.map((task) => (
                    <MissionItem
                      key={task.id}
                      task={task}
                      busy={busy}
                      onComplete={(id) => void handleCompleteTask(id)}
                    />
                  ))}
                </ul>
              </PanelContent>
            </Panel>
          )}

          {weeklyMissions.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Missões semanais</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <ul className="space-y-2">
                  {weeklyMissions.map((task) => (
                    <MissionItem
                      key={task.id}
                      task={task}
                      busy={busy}
                      onComplete={(id) => void handleCompleteTask(id)}
                    />
                  ))}
                </ul>
              </PanelContent>
            </Panel>
          )}
        </>
      )}

      {!plan && !loading && (
        <EmptyState
          title="Nenhuma missão financeira ativa"
          description="Defina quanto quer ganhar e deixe a IA montar seu plano executável."
        />
      )}

      <Panel className="border-emerald-500/15">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-emerald-400" />
            Aura Money IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {MONEY_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={iaLoading}
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                className="rounded-md border border-white/[0.06] px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-emerald-500/20 hover:text-emerald-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
            {iaMessages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={cn(
                  "text-[11px] whitespace-pre-wrap",
                  msg.role === "user" ? "text-zinc-400" : "text-zinc-300"
                )}
              >
                {msg.role === "user" ? "Você: " : "Aura: "}
                {msg.text}
              </div>
            ))}
            {iaLoading && (
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Loader2 className="size-3 animate-spin" />
                Analisando...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
            className="flex gap-2"
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="Pergunte sobre seu plano financeiro..."
              disabled={iaLoading}
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300 disabled:opacity-50"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
