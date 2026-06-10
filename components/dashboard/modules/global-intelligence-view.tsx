"use client";

import {
  ArrowRight,
  Globe,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useGlobal } from "@/hooks/use-global";
import { cn } from "@/utils/cn";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  CREATOR_COUNTRY_OPTIONS,
  CREATOR_CURRENCY_OPTIONS,
  CREATOR_LANGUAGE_OPTIONS,
  GLOBAL_IA_ACTIONS,
  GLOBAL_INTEGRATIONS,
  GLOBAL_OBJECTIVES,
  GLOBAL_PRODUCT_TYPES,
  difficultyColor,
  difficultyLabel,
  formatGlobalMoney,
  parseChannels,
  profitColor,
  profitLabel,
} from "@/utils/global";

export function GlobalIntelligenceView() {
  const {
    dashboard,
    markets,
    strategies,
    results,
    loading,
    error,
    busy,
    analyze,
    syncResults,
    removeMarket,
  } = useGlobal();

  const [productType, setProductType] = useState("curso");
  const [objective, setObjective] = useState<"proprio" | "afiliado">("proprio");
  const [productName, setProductName] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [currency, setCurrency] = useState("");
  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Global Intelligence — analiso mercados internacionais e escolho a melhor estratégia por país, idioma e moeda.",
    },
  ]);

  async function handleAnalyze() {
    const { error: analyzeError } = await analyze({
      country: country || "auto",
      language: language || "auto",
      currency: currency || "auto",
      product_type: productType,
      objective,
      product_name: productName || undefined,
    });
    if (analyzeError) {
      toast.error(analyzeError);
      return;
    }
    toast.success("Estratégias internacionais geradas!");
  }

  async function handleSync() {
    const { error: syncError, synced } = await syncResults();
    if (syncError) {
      toast.error(syncError);
      return;
    }
    toast.success(`Resultados sincronizados (${synced ?? 0} registros).`);
  }

  async function handleRemove(id: string) {
    const { error: removeError } = await removeMarket(id);
    if (removeError) {
      toast.error(removeError);
      return;
    }
    toast.success("Mercado removido.");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/global/ia", {
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
        title="Erro ao carregar Global Intelligence"
        description={error}
        action={
          <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
        }
      />
    );
  }

  function getStrategy(marketId: string) {
    return strategies.find((s) => s.market_id === marketId);
  }

  const currencyDisplay = dashboard
    ? Object.entries(dashboard.receitaPorMoedaFormatted)
        .map(([c, v]) => `${c}: ${v}`)
        .join(" · ") || "—"
    : "—";

  return (
    <div className="space-y-3">
      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Mercados ativos" value={String(dashboard.mercadosAtivos)} />
          <MetricCard label="Receita por moeda" value={currencyDisplay} />
          <MetricCard label="Total (BRL)" value={dashboard.receitaTotalFormatted} />
          <MetricCard label="Melhor mercado" value={dashboard.melhorMercado} />
          <MetricCard label="Global Score" value={dashboard.globalScoreFormatted} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => void handleAnalyze()} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          Gerar estratégias
        </ActionButton>
        <ActionButton variant="ghost" onClick={() => void handleSync()} disabled={busy}>
          <RefreshCw className="size-3" />
          Sincronizar resultados
        </ActionButton>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Análise de mercado</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Tipo de produto</span>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              >
                {GLOBAL_PRODUCT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Objetivo</span>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as "proprio" | "afiliado")}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              >
                {GLOBAL_OBJECTIVES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Nome do produto (opcional)</span>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Curso de marketing digital"
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">País foco (opcional)</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              >
                <option value="">Auto — IA escolhe</option>
                {CREATOR_COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Idioma (opcional)</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              >
                <option value="">Auto</option>
                {CREATOR_LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Moeda (opcional)</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              >
                <option value="">Auto</option>
                {CREATOR_CURRENCY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Estratégias por mercado</PanelTitle>
        </PanelHeader>
        <PanelContent>
          {markets.length === 0 ? (
            <EmptyState
              title="Nenhum mercado analisado"
              description="Configure seu produto e clique em Gerar estratégias para a IA recomendar mercados internacionais."
            />
          ) : (
            <div className="space-y-2">
              {markets.map((market) => {
                const strategy = getStrategy(market.id);
                const channels = strategy ? parseChannels(strategy.channels) : [];

                return (
                  <div
                    key={market.id}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Globe className="mt-0.5 size-4 shrink-0 text-sky-400" />
                        <div>
                          <p className="text-xs font-medium text-zinc-200">
                            {market.country}{" "}
                            <span className="text-zinc-500">
                              · {market.language} · {market.currency}
                            </span>
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {market.objective === "afiliado" ? "Afiliado" : "Produto próprio"} ·{" "}
                            {GLOBAL_PRODUCT_TYPES.find((t) => t.id === market.product_type)?.label ??
                              market.product_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {market.global_score != null && (
                          <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                            Score {market.global_score}
                          </span>
                        )}
                        <ActionButton
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => void handleRemove(market.id)}
                          disabled={busy}
                        >
                          <Trash2 className="size-3" />
                        </ActionButton>
                      </div>
                    </div>

                    {strategy && (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <p className="text-[10px] text-zinc-600">Preço sugerido</p>
                          <p className="text-xs text-zinc-300">
                            {formatGlobalMoney(
                              Number(strategy.suggested_price ?? 0),
                              strategy.currency
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600">Público</p>
                          <p className="text-xs text-zinc-300">{strategy.audience ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600">Canais</p>
                          <p className="text-xs text-zinc-300">
                            {channels.length > 0 ? channels.join(", ") : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600">Dificuldade</p>
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-[10px] font-medium",
                              difficultyColor(strategy.difficulty)
                            )}
                          >
                            {difficultyLabel(strategy.difficulty)}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-600">Potencial de lucro</p>
                          <span
                            className={cn(
                              "inline-block rounded-md px-2 py-0.5 text-[10px] font-medium",
                              profitColor(strategy.profit_potential)
                            )}
                          >
                            {profitLabel(strategy.profit_potential)}
                          </span>
                        </div>
                        {market.score_financial != null && (
                          <div>
                            <p className="text-[10px] text-zinc-600">Scores parciais</p>
                            <p className="text-[10px] text-zinc-400">
                              Fin {market.score_financial} · Conc {market.score_competition} ·
                              Entrada {market.score_entry_ease} · Legado{" "}
                              {market.score_skills_alignment}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {strategy?.ai_summary && (
                      <p className="mt-2 text-[11px] text-zinc-400">{strategy.ai_summary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </PanelContent>
      </Panel>

      {results.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Resultados</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <div className="space-y-1.5">
              {results.slice(0, 10).map((r) => {
                const market = markets.find((m) => m.id === r.market_id);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border border-white/[0.04] px-3 py-2"
                  >
                    <div>
                      <p className="text-xs text-zinc-300">
                        {r.product_name ?? market?.country ?? "Resultado"}
                      </p>
                      <p className="text-[10px] text-zinc-600">{r.source}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-200">
                        {formatGlobalMoney(Number(r.revenue_amount), r.currency)}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        ≈ {formatGlobalMoney(Number(r.revenue_converted_brl), "BRL")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {dashboard?.melhorProduto && dashboard.melhorProduto !== "—" && (
              <p className="mt-3 text-[11px] text-zinc-500">
                Melhor produto: <span className="text-zinc-300">{dashboard.melhorProduto}</span>
              </p>
            )}
          </PanelContent>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Aura Coach — Global</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {GLOBAL_IA_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => void sendIaMessage(action.label, action.id)}
                  disabled={iaLoading}
                  className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-zinc-400 transition hover:border-violet-500/30 hover:text-zinc-200"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
              {iaMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md px-3 py-2 text-[11px]",
                    msg.role === "user"
                      ? "ml-8 bg-violet-500/10 text-violet-200"
                      : "mr-8 bg-white/[0.03] text-zinc-300"
                  )}
                >
                  {msg.text}
                </div>
              ))}
              {iaLoading && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Loader2 className="size-3 animate-spin" />
                  Analisando mercados...
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                value={iaInput}
                onChange={(e) => setIaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendIaMessage(iaInput);
                }}
                placeholder="Qual país devo atacar primeiro?"
                className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              />
              <ActionButton
                onClick={() => void sendIaMessage(iaInput)}
                disabled={iaLoading || !iaInput.trim()}
              >
                <Send className="size-3" />
              </ActionButton>
            </div>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Integrações</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <p className="mb-3 text-[11px] text-zinc-500">
              Dados cruzados de Platform Hub, Creator, Market Research, Money Missions e Aura CEO.
            </p>
            <div className="space-y-1.5">
              {GLOBAL_INTEGRATIONS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-md border border-white/[0.06] px-3 py-2 text-xs text-zinc-300 transition hover:border-violet-500/30 hover:text-zinc-100"
                >
                  {link.label}
                  <ArrowRight className="size-3 text-zinc-600" />
                </Link>
              ))}
            </div>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
