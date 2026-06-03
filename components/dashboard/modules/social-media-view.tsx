"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clapperboard,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { useConteudos } from "@/hooks/use-conteudos";
import { useGrowthLeads } from "@/hooks/use-growth-leads";
import { useGrowthProfiles } from "@/hooks/use-growth-profiles";
import { parseJsonResponse } from "@/utils/safe-json";
import type { Conteudo } from "@/types/database";
import { analyzeGrowthLeadContentInsights } from "@/utils/growth";
import {
  computeSocialMetrics,
  conteudosNaSemana,
  getConteudoStatusLabel,
  getFormatoLabel,
  getPlataformaLabel,
  getSocialGrowthHints,
  normalizeConteudoFormato,
  normalizeConteudoStatus,
  parseConteudoSuggestions,
  type ParsedConteudoSuggestion,
} from "@/utils/social";
import { formatDate } from "@/utils/format";
import {
  AddConteudoModal,
  type ConteudoFormPayload,
} from "./add-conteudo-modal";
import { AuraSocial } from "./aura-social";

const networks = [
  { name: "Instagram", id: "instagram", color: "from-pink-500/40 to-purple-500/40" },
  { name: "YouTube", id: "youtube", color: "from-red-500/40 to-red-600/30" },
  { name: "TikTok", id: "tiktok", color: "from-zinc-400/30 to-zinc-500/20" },
  { name: "Facebook", id: "facebook", color: "from-blue-500/40 to-blue-600/30" },
];

export function SocialMediaView() {
  const { data: conteudos, loading, create, update, remove } = useConteudos();
  const { data: leads } = useGrowthLeads();
  const { data: profiles } = useGrowthProfiles();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conteudo | null>(null);
  const [roteiroTarget, setRoteiroTarget] = useState<Conteudo | null>(null);
  const [roteiroLoading, setRoteiroLoading] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<ParsedConteudoSuggestion[]>([]);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [iaLoading, setIaLoading] = useState<string | null>(null);

  const metrics = useMemo(() => computeSocialMetrics(conteudos), [conteudos]);
  const semana = useMemo(() => conteudosNaSemana(conteudos), [conteudos]);
  const contentInsights = useMemo(
    () => analyzeGrowthLeadContentInsights(leads),
    [leads]
  );
  const growthHints = useMemo(
    () => getSocialGrowthHints(contentInsights),
    [contentInsights]
  );

  const ideias = useMemo(
    () =>
      metrics.normalized.filter((c) => c.status !== "publicado").slice(0, 12),
    [metrics.normalized]
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  async function handleSubmit(payload: ConteudoFormPayload) {
    if (editing) {
      const result = await update(editing.id, payload);
      return { error: result.error };
    }
    const result = await create(payload);
    return { error: result.error };
  }

  async function handleGerarRoteiro(item?: Conteudo) {
    const target = item ?? ideias[0];
    if (!target) {
      toast.error("Cadastre um conteúdo antes de gerar roteiro.");
      return;
    }

    setRoteiroTarget(target);
    setRoteiroLoading(true);

    try {
      const res = await fetch("/api/social-roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: target.titulo,
          plataforma: target.plataforma,
          formato: normalizeConteudoFormato(target.formato),
          objetivo: target.objetivo,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        roteiro?: string;
        error?: string;
      }>(res);

      if (parseError) {
        toast.error(parseError);
        return;
      }

      if (!res.ok || data?.error) {
        toast.error(data?.error ?? "Erro ao gerar roteiro.");
        return;
      }

      const { error } = await update(target.id, {
        roteiro: data?.roteiro ?? "",
        status: "roteiro",
      });

      if (error) toast.error(error);
      else toast.success("Roteiro gerado e salvo.");
    } catch {
      toast.error("Erro de conexão ao gerar roteiro.");
    } finally {
      setRoteiroLoading(false);
      setRoteiroTarget(null);
    }
  }

  async function handleIaAction(
    actionKey: string,
    mode: string,
    options?: { message?: string; actionId?: string }
  ) {
    setIaLoading(actionKey);
    try {
      const res = await fetch("/api/social-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          ...(options?.actionId ? { actionId: options.actionId } : {}),
          ...(options?.message ? { message: options.message } : {}),
          ...(!options?.actionId && !options?.message
            ? { actionId: actionKey }
            : {}),
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        kind?: string;
        suggestion?: Record<string, unknown>;
        text?: string;
        error?: string;
      }>(res);

      if (parseError) {
        toast.error(parseError);
        return;
      }

      if (!res.ok || data?.error) {
        toast.error(data?.error ?? "Erro na IA Social.");
        return;
      }

      const suggestions = parseConteudoSuggestions(data?.suggestion);

      if (suggestions.length > 0) {
        setPendingSuggestions(suggestions);
        toast.success(
          `${suggestions.length} sugestão(ões) prontas. Revise e salve abaixo.`
        );
      } else if (data?.text) {
        toast.message(data.text.slice(0, 120));
      }
    } catch {
      toast.error("Erro de conexão com a IA Social.");
    } finally {
      setIaLoading(null);
    }
  }

  async function handleSaveSuggestions() {
    if (pendingSuggestions.length === 0) return;
    setSavingSuggestions(true);

    let saved = 0;
    for (const item of pendingSuggestions) {
      const data_publicacao = item.data
        ? new Date(`${item.data}T12:00:00`).toISOString()
        : null;

      const { error } = await create({
        titulo: item.titulo,
        plataforma: item.plataforma,
        formato: item.formato,
        objetivo: item.objetivo,
        observacoes: item.observacoes,
        roteiro: item.roteiro,
        data_publicacao,
        status: item.roteiro ? "roteiro" : "ideia",
      });

      if (!error) saved++;
    }

    setSavingSuggestions(false);
    setPendingSuggestions([]);

    if (saved > 0) {
      toast.success(`${saved} conteúdo(s) adicionado(s) ao calendário.`);
    } else {
      toast.error("Não foi possível salvar as sugestões.");
    }
  }

  function handleAiSuggestions(items: ParsedConteudoSuggestion[]) {
    if (items.length === 0) return;
    setPendingSuggestions(items);
  }

  async function handlePublicado(id: string) {
    const { error } = await update(id, {
      status: "publicado",
      data_publicacao: new Date().toISOString(),
    });
    if (error) toast.error(error);
    else toast.success("Marcado como publicado.");
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este conteúdo?")) return;
    const { error } = await remove(id);
    if (error) toast.error(error);
    else toast.success("Conteúdo excluído.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton icon={<Plus className="size-3.5" />} onClick={openNew}>
          Novo conteúdo
        </ActionButton>
        <ActionButton
          icon={
            roteiroLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )
          }
          onClick={() => handleGerarRoteiro()}
          disabled={roteiroLoading || ideias.length === 0}
        >
          Gerar roteiro com IA
        </ActionButton>
        <ActionButton
          icon={
            iaLoading === "calendario-semana" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CalendarDays className="size-3.5" />
            )
          }
          onClick={() =>
            handleIaAction("calendario-semana", "calendario", {
              actionId: "calendario-semana",
            })
          }
          disabled={Boolean(iaLoading)}
        >
          Planejamento semanal
        </ActionButton>
        <ActionButton
          icon={
            iaLoading === "ideias-reels" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Clapperboard className="size-3.5" />
            )
          }
          onClick={() =>
            handleIaAction("ideias-reels", "ideias", {
              message:
                "Gere 7 ideias de Reels para Instagram e TikTok com gancho, objetivo e CTA.",
            })
          }
          disabled={Boolean(iaLoading)}
        >
          Ideias para Reels
        </ActionButton>
      </div>

      {growthHints.length > 0 && (
        <Panel className="border-amber-500/10 bg-amber-500/[0.03]">
          <PanelContent className="py-2.5">
            <p className="text-[11px] font-medium text-amber-200/90">
              Integração com Crescimento
            </p>
            <ul className="mt-1 space-y-0.5">
              {growthHints.map((hint) => (
                <li key={hint} className="text-[11px] text-zinc-400">
                  · {hint}
                </li>
              ))}
            </ul>
            {profiles.length > 0 && (
              <p className="mt-1.5 text-[10px] text-zinc-500">
                Perfis:{" "}
                {profiles
                  .map(
                    (p) =>
                      `@${p.username}${p.nicho ? ` (${p.nicho})` : ""}`
                  )
                  .join(" · ")}
              </p>
            )}
          </PanelContent>
        </Panel>
      )}

      {pendingSuggestions.length > 0 && (
        <Panel className="border-violet-500/15 bg-violet-500/[0.04]">
          <PanelHeader>
            <PanelTitle>
              Sugestões da IA ({pendingSuggestions.length})
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <ul className="mb-3 max-h-[160px] space-y-1 overflow-y-auto">
              {pendingSuggestions.map((item, i) => (
                <li
                  key={`${item.titulo}-${i}`}
                  className="rounded-md border border-white/[0.04] px-2 py-1.5 text-[12px] text-zinc-300"
                >
                  <span className="font-medium">{item.titulo}</span>
                  <span className="text-zinc-500">
                    {" "}
                    · {getPlataformaLabel(item.plataforma)} ·{" "}
                    {getFormatoLabel(item.formato)}
                    {item.data ? ` · ${item.data}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <ActionButton
                onClick={handleSaveSuggestions}
                disabled={savingSuggestions}
              >
                {savingSuggestions ? "Salvando..." : "Salvar no calendário"}
              </ActionButton>
              <ActionButton onClick={() => setPendingSuggestions([])}>
                Descartar
              </ActionButton>
            </div>
          </PanelContent>
        </Panel>
      )}

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          <MetricCard
            label="Em produção"
            value={String(metrics.emProducao)}
            hint="Roteiro, gravado ou editado"
          />
          <MetricCard
            label="Posts publicados"
            value={String(metrics.publicados)}
            hint="Conteúdos no ar"
          />
          <MetricCard
            label="Ideias"
            value={String(metrics.ideias)}
            hint="Aguardando roteiro"
          />
        </div>
      )}

      <AuraSocial leads={leads} onSuggestions={handleAiSuggestions} />

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Calendário de conteúdo</PanelTitle>
          </PanelHeader>
          <PanelContent className="overflow-x-auto pt-0">
            <div className="grid min-w-[420px] grid-cols-7 gap-1">
              {semana.map((d) => (
                <div
                  key={d.day}
                  className="flex min-h-[80px] flex-col rounded-md border border-white/[0.04] p-1.5"
                >
                  <p className="text-[10px] font-medium text-zinc-500">{d.day}</p>
                  <p className="text-[9px] text-zinc-600">{d.date.slice(8, 10)}</p>
                  <div className="mt-1 flex-1 space-y-0.5">
                    {d.items.length === 0 ? (
                      <p className="text-[9px] text-zinc-600">Vazio</p>
                    ) : (
                      d.items.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          className="block w-full truncate text-left text-[9px] text-violet-300/90 hover:text-violet-200"
                          title={c.titulo}
                        >
                          {c.titulo}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Ideias e pipeline</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {loading ? (
              <ListSkeleton rows={5} />
            ) : ideias.length === 0 ? (
              <EmptyState
                title="Nenhuma ideia cadastrada"
                description="Adicione ideias de vídeos, posts e roteiros."
                action={
                  <ActionButton onClick={openNew}>Novo conteúdo</ActionButton>
                }
              />
            ) : (
              <ul className="max-h-[280px] space-y-2 overflow-y-auto">
                {ideias.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-white/[0.04] p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-zinc-200">
                          {c.titulo}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {getPlataformaLabel(c.plataforma)}
                          {c.formato
                            ? ` · ${getFormatoLabel(c.formato)}`
                            : ""}
                          {c.data_publicacao
                            ? ` · ${formatDate(c.data_publicacao)}`
                            : ""}{" "}
                          · {getConteudoStatusLabel(normalizeConteudoStatus(c.status))}
                        </p>
                        {c.roteiro && (
                          <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-600">
                            {c.roteiro.slice(0, 120)}
                            {c.roteiro.length > 120 ? "…" : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          title="Gerar roteiro"
                          disabled={roteiroLoading && roteiroTarget?.id === c.id}
                          onClick={() => handleGerarRoteiro(c)}
                          className="rounded p-1 text-zinc-500 hover:text-violet-300"
                        >
                          {roteiroLoading && roteiroTarget?.id === c.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                        </button>
                        {normalizeConteudoStatus(c.status) !== "publicado" && (
                          <button
                            type="button"
                            title="Marcar como publicado"
                            onClick={() => handlePublicado(c.id)}
                            className="rounded p-1 text-zinc-500 hover:text-emerald-400"
                          >
                            <Check className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          className="rounded p-1 text-zinc-500 hover:text-violet-300"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => handleDelete(c.id)}
                          className="rounded p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {networks.map((n) => {
          const platStats = metrics.porPlataforma[n.id] ?? {
            planejados: 0,
            publicados: 0,
          };

          return (
            <Panel key={n.name}>
              <PanelContent className="py-3">
                <div className={`mb-2 h-1 rounded-full bg-gradient-to-r ${n.color}`} />
                <p className="text-[13px] font-medium text-zinc-200">{n.name}</p>
                <div className="mt-2 flex justify-between text-[11px]">
                  <span className="text-zinc-600">
                    Planejados:{" "}
                    <span className="text-zinc-400">{platStats.planejados}</span>
                  </span>
                  <span className="text-zinc-600">
                    Publicados:{" "}
                    <span className="text-zinc-400">{platStats.publicados}</span>
                  </span>
                </div>
              </PanelContent>
            </Panel>
          );
        })}
      </div>

      <AddConteudoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
