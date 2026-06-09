"use client";

import {
  AlertTriangle,
  Crown,
  Loader2,
  Rocket,
  Send,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useAuraXp } from "@/hooks/use-aura-xp";
import { usePerformance } from "@/hooks/use-performance";
import { cn } from "@/utils/cn";
import { PERFORMANCE_IA_ACTIONS } from "@/utils/performance";
import { parseJsonResponse } from "@/utils/safe-json";

function PanelCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
      <p className={cn("mb-1 flex items-center gap-1.5 text-[10px] font-medium", accent)}>
        <Icon className="size-3" />
        {label}
      </p>
      <p className="text-[11px] leading-relaxed text-zinc-300">{value}</p>
    </div>
  );
}

function MemoryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] text-zinc-400">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PerformanceView() {
  const { refresh: refreshXp } = useAuraXp();
  const {
    dashboard,
    report,
    panel,
    analysis,
    executiveMemory,
    loading,
    error,
    busy,
    generateReport,
    removeReport,
  } = usePerformance();

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Performance AI — analiso resultados de todos os módulos e tomo decisões estratégicas. Gere uma análise para começar.",
    },
  ]);

  async function handleGenerate() {
    const { error: genError } = await generateReport();
    if (genError) {
      toast.error(genError);
      return;
    }
    toast.success("Análise de performance gerada!");
    void refreshXp();
  }

  async function handleDelete() {
    if (!report) return;
    const { error: delError } = await removeReport(report.id);
    if (delError) {
      toast.error(delError);
      return;
    }
    toast.success("Relatório removido.");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const historyMsgs = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/performance/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: historyMsgs,
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
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Erro" description={error} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => void handleGenerate()} disabled={busy}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          Gerar análise IA
        </ActionButton>
        {report && (
          <ActionButton variant="ghost" onClick={() => void handleDelete()} disabled={busy}>
            <Trash2 className="size-3.5" />
            Excluir relatório
          </ActionButton>
        )}
      </div>

      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Receita" value={dashboard.receitaFormatted} />
          <MetricCard label="Meta atingida" value={dashboard.metaAtingidaFormatted} />
          <MetricCard label="Projetos ativos" value={String(dashboard.projetosAtivos)} />
          <MetricCard label="Taxa de execução" value={dashboard.taxaExecucaoFormatted} />
          <MetricCard label="XP" value={`${dashboard.xpTotal} (Nv ${dashboard.xpNivel})`} />
          <MetricCard
            label="Conteúdos publicados"
            value={String(dashboard.conteudosPublicados)}
          />
          <MetricCard label="Lançamentos" value={String(dashboard.lancamentos)} />
          <MetricCard label="ROI estimado" value={dashboard.roiEstimadoFormatted} />
        </div>
      )}

      {panel && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Painel estratégico</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <div className="grid gap-2 sm:grid-cols-2">
              <PanelCard
                icon={TrendingUp}
                label="Maior oportunidade"
                value={panel.maiorOportunidade}
                accent="text-emerald-400"
              />
              <PanelCard
                icon={AlertTriangle}
                label="Maior risco"
                value={panel.maiorRisco}
                accent="text-rose-400"
              />
              <PanelCard
                icon={TrendingDown}
                label="Maior desperdício"
                value={panel.maiorDesperdicio}
                accent="text-amber-400"
              />
              <PanelCard
                icon={Rocket}
                label="Melhor projeto"
                value={panel.melhorProjeto}
                accent="text-violet-400"
              />
            </div>
            <div className="mt-3 rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-violet-300">
                <Crown className="size-3" />
                Conselho do Aura CEO
              </p>
              <p className="text-[11px] italic leading-relaxed text-zinc-300">
                &ldquo;{panel.conselhoCeo}&rdquo;
              </p>
            </div>
          </PanelContent>
        </Panel>
      )}

      {analysis && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Análise estratégica</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <PanelCard
                icon={TrendingUp}
                label="O que está funcionando?"
                value={analysis.oQueFunciona}
                accent="text-emerald-400"
              />
              <PanelCard
                icon={AlertTriangle}
                label="O que está atrasando?"
                value={analysis.oQueAtrasa}
                accent="text-rose-400"
              />
              <PanelCard
                icon={Rocket}
                label="Qual projeto acelerar?"
                value={analysis.projetoAcelerar}
                accent="text-cyan-400"
              />
              <PanelCard
                icon={TrendingDown}
                label="Qual projeto abandonar?"
                value={analysis.projetoAbandonar}
                accent="text-amber-400"
              />
            </div>
            <PanelCard
              icon={Sparkles}
              label="Maior potencial"
              value={analysis.maiorPotencial}
              accent="text-violet-400"
            />
          </PanelContent>
        </Panel>
      )}

      {executiveMemory && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Executive Memory</PanelTitle>
          </PanelHeader>
          <PanelContent className="grid gap-3 sm:grid-cols-2">
            <MemoryList title="Campanhas boas" items={executiveMemory.campanhasBoas} />
            <MemoryList title="Produtos bons" items={executiveMemory.produtosBons} />
            <MemoryList title="Hábitos produtivos" items={executiveMemory.habitosProdutivos} />
            <MemoryList title="Erros recorrentes" items={executiveMemory.errosRecorrentes} />
          </PanelContent>
        </Panel>
      )}

      {!report && dashboard && (
        <EmptyState
          title="Nenhuma análise gerada"
          description="Clique em Gerar análise IA para cruzar dados de Financeiro, Money, Social, Creator, Launch, Ads, Execution e CEO."
        />
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Aura Performance AI</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {iaMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md px-3 py-2 text-[11px] leading-relaxed",
                  msg.role === "user"
                    ? "ml-8 bg-violet-500/10 text-violet-100"
                    : "mr-8 bg-white/[0.03] text-zinc-300"
                )}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PERFORMANCE_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={iaLoading}
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
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
              placeholder="Pergunte sobre performance estratégica..."
              disabled={iaLoading}
              className="flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
            <ActionButton type="submit" disabled={iaLoading || !iaInput.trim()}>
              {iaLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
