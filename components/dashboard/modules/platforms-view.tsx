"use client";

import {
  ArrowRight,
  Loader2,
  Plug,
  RefreshCw,
  Send,
  Sparkles,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { usePlatforms } from "@/hooks/use-platforms";
import type { PlatformId } from "@/lib/platforms/types";
import { cn } from "@/utils/cn";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  ACTIVE_PLATFORMS,
  FUTURE_PLATFORMS,
  PLATFORMS_IA_ACTIONS,
  PLATFORMS_INTEGRATIONS,
  formatCents,
  platformLabel,
  statusColor,
  statusLabel,
  type PlatformDefinition,
} from "@/utils/platforms";

function ConnectionModal({
  platform,
  onClose,
  onConnect,
  busy,
}: {
  platform: PlatformDefinition;
  onClose: () => void;
  onConnect: (credentials: Record<string, string>) => Promise<void>;
  busy: boolean;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-zinc-950 p-4 shadow-xl">
        <h3 className="mb-1 text-sm font-medium text-zinc-100">
          Conectar {platform.label}
        </h3>
        <p className="mb-4 text-[11px] text-zinc-500">{platform.description}</p>

        <div className="space-y-3">
          {platform.credentialFields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">{field.label}</span>
              <input
                type={field.type ?? "text"}
                value={credentials[field.key] ?? ""}
                onChange={(e) =>
                  setCredentials((c) => ({ ...c, [field.key]: e.target.value }))
                }
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                placeholder={field.label}
              />
            </label>
          ))}
        </div>

        <p className="mt-3 text-[10px] text-zinc-600">
          Credenciais criptografadas — nunca armazenadas em texto puro.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <ActionButton variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </ActionButton>
          <ActionButton
            onClick={() => void onConnect(credentials)}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Plug className="size-3" />}
            Conectar
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function PlatformsView() {
  const {
    dashboard,
    connections,
    products,
    syncLogs,
    analyses,
    loading,
    error,
    busy,
    connect,
    sync,
    analyze,
    disconnect,
  } = usePlatforms();

  const [connectTarget, setConnectTarget] = useState<PlatformDefinition | null>(null);
  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Platform Hub — conecte Kiwify, Hotmart, Eduzz ou Monetizze. Para integração dedicada Kiwify, use Kiwify Connect.",
    },
  ]);

  function getConnection(platformId: PlatformId) {
    return connections.find((c) => c.platform === platformId);
  }

  async function handleConnect(credentials: Record<string, string>) {
    if (!connectTarget) return;
    const { error: connectError } = await connect({
      platform: connectTarget.id,
      authType: connectTarget.authType,
      credentials,
    });
    if (connectError) {
      toast.error(connectError);
      return;
    }
    toast.success(`${connectTarget.label} conectado!`);
    setConnectTarget(null);
  }

  async function handleSync(platform?: PlatformId) {
    const { error: syncError } = await sync(platform);
    if (syncError) {
      toast.error(syncError);
      return;
    }
    toast.success("Sincronização concluída!");
  }

  async function handleAnalyze() {
    const { error: analyzeError } = await analyze();
    if (analyzeError) {
      toast.error(analyzeError);
      return;
    }
    toast.success("Score IA gerado!");
  }

  async function handleDisconnect(platform: PlatformId) {
    const { error: disconnectError } = await disconnect(platform);
    if (disconnectError) {
      toast.error(disconnectError);
      return;
    }
    toast.success("Plataforma desconectada.");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/platforms/ia", {
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
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Erro ao carregar Platform Hub"
        description={error}
        action={
          <ActionButton onClick={() => window.location.reload()}>Tentar novamente</ActionButton>
        }
      />
    );
  }

  const rankedAnalyses = [...analyses]
    .filter((a) => a.ai_score != null)
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  return (
    <div className="space-y-3">
      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Receita" value={dashboard.receitaFormatted} />
          <MetricCard label="Comissões" value={dashboard.comissoesFormatted} />
          <MetricCard label="Produtos" value={String(dashboard.produtosTotal)} />
          <MetricCard label="Conversão" value={dashboard.conversaoFormatted} />
          <MetricCard label="Top produto" value={dashboard.topProduto} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => void handleSync()} disabled={busy}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Sincronizar tudo
        </ActionButton>
        <Link
          href="/dashboard/platforms/kiwify"
          className="inline-flex h-8 items-center rounded-md border border-violet-500/30 px-3 text-[11px] text-violet-300 hover:bg-violet-500/10"
        >
          Kiwify Connect →
        </Link>
        <Link
          href="/dashboard/platforms/meta/intelligence"
          className="inline-flex h-8 items-center rounded-md border border-sky-500/30 px-3 text-[11px] text-sky-300 hover:bg-sky-500/10"
        >
          Meta Intelligence →
        </Link>
        <ActionButton variant="ghost" onClick={() => void handleAnalyze()} disabled={busy}>
          <Sparkles className="size-3" />
          Gerar Score IA
        </ActionButton>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Plataformas</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIVE_PLATFORMS.map((platform) => {
              const conn = getConnection(platform.id);
              return (
                <div
                  key={platform.id}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{platform.label}</p>
                      <p className="text-[10px] text-zinc-500">{platform.description}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium",
                        statusColor(conn?.status ?? "disconnected")
                      )}
                    >
                      {statusLabel(conn?.status ?? "disconnected")}
                    </span>
                  </div>

                  {conn?.account_label && (
                    <p className="mb-2 text-[10px] text-zinc-500">{conn.account_label}</p>
                  )}
                  {conn?.last_error && (
                    <p className="mb-2 text-[10px] text-rose-400">{conn.last_error}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {conn?.status === "connected" ? (
                      <>
                        <ActionButton
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => void handleSync(platform.id)}
                          disabled={busy}
                        >
                          <RefreshCw className="size-3" />
                          Sync
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => void handleDisconnect(platform.id)}
                          disabled={busy}
                        >
                          <Unplug className="size-3" />
                          Desconectar
                        </ActionButton>
                      </>
                    ) : (
                      <ActionButton
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setConnectTarget(platform)}
                        disabled={busy}
                      >
                        <Plug className="size-3" />
                        Conectar
                      </ActionButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {FUTURE_PLATFORMS.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-600">
                Em breve
              </p>
              <div className="flex flex-wrap gap-2">
                {FUTURE_PLATFORMS.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-500"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Score IA — Afiliados</PanelTitle>
          </PanelHeader>
          <PanelContent>
            {rankedAnalyses.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                Sincronize produtos e clique em **Gerar Score IA** para ranquear oportunidades.
              </p>
            ) : (
              <ul className="space-y-2">
                {rankedAnalyses.slice(0, 8).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-zinc-200">
                        {a.summary?.split("|")[0]?.trim() ?? "Produto"}
                      </p>
                      <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                        {a.ai_score}/100
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {platformLabel(a.platform ?? "")} · Ticket{" "}
                      {a.ticket_medio != null
                        ? formatCents(Math.round(a.ticket_medio * 100))
                        : "—"}
                    </p>
                    {a.legado_compat && (
                      <p className="mt-1 text-[10px] text-zinc-600">{a.legado_compat}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Produtos sincronizados</PanelTitle>
          </PanelHeader>
          <PanelContent>
            {products.length === 0 ? (
              <p className="text-[11px] text-zinc-500">
                Nenhum produto importado. Conecte uma plataforma e sincronize.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {products.slice(0, 20).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] px-2 py-1.5"
                  >
                    <div>
                      <p className="text-[11px] text-zinc-300">{p.name}</p>
                      <p className="text-[10px] text-zinc-600">{platformLabel(p.platform)}</p>
                    </div>
                    {p.commission_cents != null && (
                      <span className="text-[10px] text-emerald-400">
                        {formatCents(p.commission_cents)}
                      </span>
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
          <PanelTitle>Integrações</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS_INTEGRATIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2.5 py-1.5 text-[10px] text-zinc-400 transition hover:border-violet-500/30 hover:text-zinc-200"
              >
                {item.label}
                <ArrowRight className="size-3" />
              </Link>
            ))}
          </div>
        </PanelContent>
      </Panel>

      {syncLogs.length > 0 && (
        <Panel>
          <PanelHeader>
            <PanelTitle>Últimas sincronizações</PanelTitle>
          </PanelHeader>
          <PanelContent>
            <ul className="space-y-1">
              {syncLogs.slice(0, 5).map((log) => (
                <li key={log.id} className="flex justify-between text-[10px] text-zinc-500">
                  <span>
                    {platformLabel(log.platform)} · {log.records_synced} registros
                  </span>
                  <span className={log.status === "success" ? "text-emerald-400" : "text-rose-400"}>
                    {log.status}
                  </span>
                </li>
              ))}
            </ul>
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Aura Platform IA</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PLATFORMS_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.label, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 transition hover:border-violet-500/30 hover:text-zinc-200 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.06] bg-black/20 p-2">
            {iaMessages.map((msg, idx) => (
              <p
                key={`${msg.role}-${idx}`}
                className={cn(
                  "text-[11px] leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "text-violet-300" : "text-zinc-400"
                )}
              >
                {msg.text}
              </p>
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
              placeholder="Pergunte sobre afiliação, produtos ou resultados..."
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
              disabled={iaLoading}
            />
            <ActionButton type="submit" disabled={iaLoading || !iaInput.trim()}>
              {iaLoading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" />
              )}
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>

      {connectTarget && (
        <ConnectionModal
          platform={connectTarget}
          onClose={() => setConnectTarget(null)}
          onConnect={handleConnect}
          busy={busy}
        />
      )}
    </div>
  );
}
