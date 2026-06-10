"use client";

import {
  ArrowRight,
  BookOpen,
  Brain,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
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
import { useKnowledge } from "@/hooks/use-knowledge";
import { cn } from "@/utils/cn";
import {
  KNOWLEDGE_ENTRY_TYPES,
  KNOWLEDGE_IA_ACTIONS,
  KNOWLEDGE_INTEGRATIONS,
  formatKnowledgeMoney,
  insightTypeColor,
  insightTypeLabel,
  parseEntryMetrics,
  priorityColor,
} from "@/utils/knowledge";
import { parseJsonResponse } from "@/utils/safe-json";

export function KnowledgeConnectView() {
  const {
    dashboard,
    entries,
    insights,
    patterns,
    marketHistory,
    connectors,
    loading,
    error,
    busy,
    syncFromIntegrations,
    generateInsights,
    removeEntry,
    dismissInsight,
  } = useKnowledge();

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Knowledge & Connect — aprendo com suas fontes externas e registro o que funciona para escalar.",
    },
  ]);

  async function handleSync() {
    const { error: syncError, synced } = await syncFromIntegrations();
    if (syncError) {
      toast.error(syncError);
      return;
    }
    toast.success(`Sincronizado (${synced ?? 0} registros). Padrões atualizados.`);
  }

  async function handleGenerateInsights() {
    const { error: genError, count } = await generateInsights();
    if (genError) {
      toast.error(genError);
      return;
    }
    toast.success(`${count ?? 0} insights gerados.`);
  }

  async function handleRemove(id: string) {
    const { error: removeError } = await removeEntry(id);
    if (removeError) {
      toast.error(removeError);
      return;
    }
    toast.success("Entrada removida.");
  }

  async function handleDismissInsight(id: string) {
    const { error: dismissError } = await dismissInsight(id);
    if (dismissError) {
      toast.error(dismissError);
      return;
    }
    toast.success("Insight dispensado.");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/knowledge/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, ...(actionId ? { actionId } : {}) }),
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
        <MetricsSkeleton count={5} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar Knowledge & Connect"
        description={error}
        action={
          <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
        }
      />
    );
  }

  const activeInsights = insights.filter((i) => i.status === "active");
  const winners = entries.filter((e) => e.category === "winner" && e.status === "active");
  const executivePatterns = patterns.filter((p) =>
    ["what_worked", "what_failed", "best_country", "best_currency"].includes(p.pattern_type)
  );

  const vendasPaisDisplay = dashboard
    ? Object.entries(dashboard.vendasPorPais)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${formatKnowledgeMoney(v)}`)
        .join(" · ") || "—"
    : "—";

  return (
    <div className="space-y-3">
      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Entradas" value={String(dashboard.entradasTotal)} />
          <MetricCard label="Vencedores" value={String(dashboard.vencedoresTotal)} />
          <MetricCard label="Insights" value={String(dashboard.insightsAtivos)} />
          <MetricCard label="Melhor mercado" value={dashboard.melhorMercado} />
          <MetricCard label="Aprendizado" value={dashboard.aprendizadoMes} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => void handleSync()} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Sincronizar e aprender
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => void handleGenerateInsights()} disabled={busy}>
          <Sparkles className="size-3" />
          Gerar insights
        </ActionButton>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Link2 className="size-3.5" />
            Fontes e conectores
          </PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {connectors.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition hover:border-violet-500/30"
              >
                <div>
                  <p className="text-xs font-medium text-zinc-200">{c.label}</p>
                  <p className="text-[10px] text-zinc-500">{c.description}</p>
                </div>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-medium uppercase",
                    c.status === "connected" && "text-emerald-400 bg-emerald-500/10",
                    c.status === "disconnected" && "text-zinc-400 bg-zinc-500/10",
                    c.status === "coming_soon" && "text-violet-400 bg-violet-500/10"
                  )}
                >
                  {c.status === "connected"
                    ? "Conectado"
                    : c.status === "coming_soon"
                      ? "Em breve"
                      : "Desconectado"}
                </span>
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <BookOpen className="size-3.5" />
              Base de conhecimento
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {winners.length === 0 ? (
              <EmptyState
                title="Nenhuma entrada vencedora"
                description="Sincronize Platform Hub, Meta Business ou plataformas de vendas."
              />
            ) : (
              <ul className="space-y-2">
                {winners.slice(0, 8).map((entry) => {
                  const typeLabel =
                    KNOWLEDGE_ENTRY_TYPES.find((t) => t.id === entry.entry_type)?.label ??
                    entry.entry_type;
                  const metrics = parseEntryMetrics(entry.metrics);
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-zinc-200">{entry.title}</p>
                        <p className="text-[10px] text-zinc-500">
                          {typeLabel}
                          {entry.country ? ` · ${entry.country}` : ""}
                          {entry.performance_score != null
                            ? ` · Score ${entry.performance_score}`
                            : ""}
                          {metrics.revenue != null
                            ? ` · ${formatKnowledgeMoney(metrics.revenue, entry.currency ?? "BRL")}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRemove(entry.id)}
                        className="shrink-0 text-zinc-500 hover:text-rose-400"
                        aria-label="Remover"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Brain className="size-3.5" />
              Executive Memory
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {executivePatterns.length === 0 ? (
              <EmptyState
                title="Memória executiva vazia"
                description="A Aura aprende o que funcionou e o que falhou após sincronizar."
              />
            ) : (
              <ul className="space-y-2">
                {executivePatterns.slice(0, 8).map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <p className="text-xs font-medium text-zinc-200">{p.label}</p>
                    <p className="text-[10px] text-zinc-500">
                      {p.pattern_type.replace(/_/g, " ")}
                      {p.country ? ` · ${p.country}` : ""}
                      {p.currency ? ` · ${p.currency}` : ""}
                      {` · Confiança ${p.confidence_score}%`}
                    </p>
                    {p.description && (
                      <p className="mt-1 text-[10px] text-zinc-400">{p.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Global Learning</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-zinc-500">Vendas por país</p>
              <p className="text-xs text-zinc-200">{vendasPaisDisplay}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-zinc-500">Melhor moeda</p>
              <p className="text-xs text-zinc-200">{dashboard?.melhorMoeda ?? "—"}</p>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-zinc-500">Histórico</p>
              <p className="text-xs text-zinc-200">{marketHistory.length} registros</p>
            </div>
          </div>

          {marketHistory.length === 0 ? (
            <EmptyState
              title="Sem histórico de mercado"
              description="ROAS, CTR e conversão por mercado aparecem após sincronizar."
            />
          ) : (
            <ul className="space-y-2">
              {marketHistory.slice(0, 6).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-zinc-400"
                >
                  <span className="font-medium text-zinc-200">{row.country}</span>
                  <span>{row.currency}</span>
                  <span>{formatKnowledgeMoney(Number(row.sales_amount), row.currency)}</span>
                  {row.roas != null && <span>ROAS {row.roas}x</span>}
                  {row.ctr != null && <span>CTR {row.ctr}%</span>}
                  {row.conversion_rate != null && <span>Conv. {row.conversion_rate}%</span>}
                </li>
              ))}
            </ul>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Insights automáticos</PanelTitle>
        </PanelHeader>
        <PanelContent>
          {activeInsights.length === 0 ? (
            <EmptyState
              title="Nenhum insight ativo"
              description="Clique em Gerar insights para oportunidades, riscos e tendências."
            />
          ) : (
            <ul className="space-y-2">
              {activeInsights.slice(0, 8).map((insight) => (
                <li
                  key={insight.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-medium",
                          insightTypeColor(insight.insight_type)
                        )}
                      >
                        {insightTypeLabel(insight.insight_type)}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-medium",
                          priorityColor(insight.priority)
                        )}
                      >
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-zinc-200">{insight.title}</p>
                    <p className="text-[10px] text-zinc-500">{insight.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDismissInsight(insight.id)}
                    className="shrink-0 text-zinc-500 hover:text-zinc-300"
                    aria-label="Dispensar"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Aura Coach — Knowledge</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {KNOWLEDGE_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.label, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300 transition hover:border-violet-500/40 hover:text-violet-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.06] bg-black/20 p-3">
            {iaMessages.map((msg, i) => (
              <p
                key={i}
                className={cn(
                  "text-[11px] leading-relaxed",
                  msg.role === "user" ? "text-violet-300" : "text-zinc-300"
                )}
              >
                {msg.role === "user" ? "Você: " : "Aura: "}
                {msg.text}
              </p>
            ))}
            {iaLoading && (
              <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Loader2 className="size-3 animate-spin" />
                Pensando...
              </p>
            )}
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
              placeholder="Pergunte sobre aprendizado, mercados ou campanhas..."
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
            />
            <ActionButton type="submit" disabled={iaLoading || !iaInput.trim()}>
              <Send className="size-3" />
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Integrações Aura</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-2">
            {KNOWLEDGE_INTEGRATIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300 transition hover:border-violet-500/40"
              >
                {item.label}
                <ArrowRight className="size-2.5" />
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
