"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Loader2,
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
import { parseJsonResponse } from "@/utils/safe-json";
import type { Conteudo } from "@/types/database";
import {
  computeSocialMetrics,
  conteudosNaSemana,
  getConteudoStatusLabel,
  normalizeConteudoStatus,
} from "@/utils/social";
import { formatDate } from "@/utils/format";
import {
  AddConteudoModal,
  type ConteudoFormPayload,
} from "./add-conteudo-modal";

const networks = [
  { name: "Instagram", id: "instagram", color: "from-pink-500/40 to-purple-500/40" },
  { name: "YouTube", id: "youtube", color: "from-red-500/40 to-red-600/30" },
  { name: "TikTok", id: "tiktok", color: "from-zinc-400/30 to-zinc-500/20" },
  { name: "Facebook", id: "facebook", color: "from-blue-500/40 to-blue-600/30" },
];

export function SocialMediaView() {
  const { data: conteudos, loading, create, update, remove } = useConteudos();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conteudo | null>(null);
  const [roteiroTarget, setRoteiroTarget] = useState<Conteudo | null>(null);
  const [roteiroLoading, setRoteiroLoading] = useState(false);

  const metrics = useMemo(() => computeSocialMetrics(conteudos), [conteudos]);
  const semana = useMemo(() => conteudosNaSemana(conteudos), [conteudos]);

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
          formato: target.formato ?? "reels",
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

  async function handlePublicado(id: string) {
    const { error } = await update(id, { status: "publicado" });
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
      <div className="flex justify-end gap-2">
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
      </div>

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

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Calendário de conteúdo</PanelTitle>
          </PanelHeader>
          <PanelContent className="overflow-x-auto pt-0">
            <div className="grid min-w-[280px] grid-cols-5 gap-1">
              {semana.map((d) => (
                <div
                  key={d.day}
                  className="flex min-h-[72px] flex-col rounded-md border border-white/[0.04] p-1.5"
                >
                  <p className="text-[10px] font-medium text-zinc-500">{d.day}</p>
                  <div className="mt-1 flex-1 space-y-0.5">
                    {d.items.length === 0 ? (
                      <p className="text-[9px] text-zinc-600">Vazio</p>
                    ) : (
                      d.items.map((c) => (
                        <p
                          key={c.id}
                          className="truncate text-[9px] text-violet-300/90"
                          title={c.titulo}
                        >
                          {c.titulo}
                        </p>
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
              <ul className="max-h-[240px] space-y-2 overflow-y-auto">
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
                        <p className="text-[11px] capitalize text-zinc-500">
                          {c.plataforma}
                          {c.data_publicacao
                            ? ` · ${formatDate(c.data_publicacao)}`
                            : ""}{" "}
                          · {getConteudoStatusLabel(normalizeConteudoStatus(c.status))}
                        </p>
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
                            title="Publicado"
                            onClick={() => handlePublicado(c.id)}
                            className="rounded p-1 text-zinc-500 hover:text-emerald-400"
                          >
                            <Check className="size-3.5" />
                          </button>
                        )}
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
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(c);
                        setModalOpen(true);
                      }}
                      className="mt-1 text-[11px] text-violet-400/80 hover:text-violet-300"
                    >
                      Editar
                    </button>
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
