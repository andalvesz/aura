"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clapperboard,
  Image,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { useConteudos } from "@/hooks/use-conteudos";
import { useGrowthLeads } from "@/hooks/use-growth-leads";
import { useGrowthProfiles } from "@/hooks/use-growth-profiles";
import { parseJsonResponse } from "@/utils/safe-json";
import type { Conteudo, InstagramMarca } from "@/types/database";
import { analyzeGrowthLeadContentInsights } from "@/utils/growth";
import {
  computeSocialMetrics,
  getSocialGrowthHints,
  parseConteudoSuggestions,
  type ParsedConteudoSuggestion,
} from "@/utils/social";
import { filterConteudosByMarca } from "@/utils/instagram";
import {
  AddConteudoModal,
  type ConteudoFormPayload,
} from "./add-conteudo-modal";
import { AuraSocial } from "./aura-social";
import { InstagramProfilesPanel } from "./instagram-profiles-panel";
import { InstagramCalendarPanel } from "./instagram-calendar-panel";
import { InstagramPipelinePanel } from "./instagram-pipeline-panel";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

export function SocialMediaView() {
  const { data: conteudos, loading, create, update, remove } = useConteudos();
  const { data: leads } = useGrowthLeads();
  const { data: profiles, refresh: refreshProfiles } = useGrowthProfiles();
  const [activeMarca, setActiveMarca] = useState<InstagramMarca>("marca_pessoal");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conteudo | null>(null);
  const [roteiroTarget, setRoteiroTarget] = useState<Conteudo | null>(null);
  const [roteiroLoading, setRoteiroLoading] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState<ParsedConteudoSuggestion[]>([]);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [iaLoading, setIaLoading] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterConteudosByMarca(conteudos, activeMarca),
    [conteudos, activeMarca]
  );

  const metrics = useMemo(() => computeSocialMetrics(filtered), [filtered]);
  const contentInsights = useMemo(
    () => analyzeGrowthLeadContentInsights(leads),
    [leads]
  );
  const growthHints = useMemo(
    () => getSocialGrowthHints(contentInsights),
    [contentInsights]
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  async function handleSubmit(payload: ConteudoFormPayload) {
    const withMarca = { ...payload, marca: payload.marca ?? activeMarca };
    if (editing) {
      return update(editing.id, withMarca);
    }
    return create(withMarca);
  }

  async function handleGerarRoteiro(item: Conteudo) {
    setRoteiroTarget(item);
    setRoteiroLoading(true);
    try {
      const res = await fetch("/api/social-roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: item.titulo,
          plataforma: item.plataforma,
          formato: item.formato,
          objetivo: item.objetivo,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        roteiro?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        toast.error(data?.error ?? parseError ?? "Erro ao gerar roteiro.");
        return;
      }

      const { error } = await update(item.id, {
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
          marca: activeMarca,
          ...(options?.actionId ? { actionId: options.actionId } : {}),
          ...(options?.message ? { message: options.message } : {}),
          ...(!options?.actionId && !options?.message ? { actionId: actionKey } : {}),
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        suggestion?: Record<string, unknown>;
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        toast.error(data?.error ?? parseError ?? "Erro na IA Social.");
        return;
      }

      const suggestions = parseConteudoSuggestions(data?.suggestion).map((s) => ({
        ...s,
        marca: s.marca ?? activeMarca,
      }));

      if (suggestions.length > 0) {
        setPendingSuggestions(suggestions);
        toast.success(`${suggestions.length} sugestão(ões) prontas.`);
      } else if (data?.text) {
        toast.message(data.text.slice(0, 160));
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
        marca: (item.marca as InstagramMarca) ?? activeMarca,
      });

      if (!error) saved++;
    }

    setSavingSuggestions(false);
    setPendingSuggestions([]);
    if (saved > 0) toast.success(`${saved} conteúdo(s) adicionado(s).`);
    else toast.error("Não foi possível salvar.");
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
      <InstagramProfilesPanel
        profiles={profiles}
        activeMarca={activeMarca}
        onMarcaChange={setActiveMarca}
        onRefresh={() => void refreshProfiles()}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton icon={<Plus className="size-3.5" />} onClick={openNew}>
          Novo conteúdo
        </ActionButton>
        <ActionButton
          icon={
            iaLoading === "post-hoje" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )
          }
          onClick={() =>
            handleIaAction("post-hoje", "post-hoje", { actionId: "post-hoje" })
          }
          disabled={Boolean(iaLoading)}
        >
          O que postar hoje?
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
          Calendário semanal
        </ActionButton>
        <ActionButton
          icon={
            iaLoading === "calendario-mes" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CalendarDays className="size-3.5" />
            )
          }
          onClick={() =>
            handleIaAction("calendario-mes", "calendario-mes", {
              actionId: "calendario-mes",
            })
          }
          disabled={Boolean(iaLoading)}
        >
          Calendário mensal
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
            handleIaAction("ideias-reels", "ideias", { actionId: "ideias-reels" })
          }
          disabled={Boolean(iaLoading)}
        >
          Ideias Reels
        </ActionButton>
        <ActionButton
          icon={
            iaLoading === "ideias-stories" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Image className="size-3.5" />
            )
          }
          onClick={() =>
            handleIaAction("ideias-stories", "ideias-stories", {
              actionId: "ideias-stories",
            })
          }
          disabled={Boolean(iaLoading)}
        >
          Ideias Stories
        </ActionButton>
      </div>

      {growthHints.length > 0 && (
        <Panel className="border-amber-500/10 bg-amber-500/[0.03]">
          <PanelContent className="py-2.5">
            <p className="text-[11px] font-medium text-amber-200/90">
              Dados reais (CRM · metas · eventos)
            </p>
            <ul className="mt-1 space-y-0.5">
              {growthHints.map((hint) => (
                <li key={hint} className="text-[11px] text-zinc-400">
                  · {hint}
                </li>
              ))}
            </ul>
          </PanelContent>
        </Panel>
      )}

      {pendingSuggestions.length > 0 && (
        <Panel className="border-violet-500/15 bg-violet-500/[0.04]">
          <PanelHeader>
            <PanelTitle>Sugestões da IA ({pendingSuggestions.length})</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <ul className="mb-3 max-h-[160px] space-y-1 overflow-y-auto">
              {pendingSuggestions.map((item, i) => (
                <li
                  key={`${item.titulo}-${i}`}
                  className="rounded-md border border-white/[0.04] px-2 py-1.5 text-[12px] text-zinc-300"
                >
                  {item.titulo}
                  {item.data ? ` · ${item.data}` : ""}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <ActionButton onClick={handleSaveSuggestions} disabled={savingSuggestions}>
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
          <MetricCard label="Em produção" value={String(metrics.emProducao)} />
          <MetricCard label="Publicados" value={String(metrics.publicados)} />
          <MetricCard label="Ideias" value={String(metrics.ideias)} />
        </div>
      )}

      <AuraSocial
        leads={leads}
        marca={activeMarca}
        onSuggestions={(items) =>
          setPendingSuggestions(
            items.map((s) => ({ ...s, marca: s.marca ?? activeMarca }))
          )
        }
      />

      <InstagramCalendarPanel
        conteudos={filtered}
        onSelect={(c) => {
          setEditing(c);
          setModalOpen(true);
        }}
      />

      <InstagramPipelinePanel
        conteudos={filtered}
        onEdit={(c) => {
          setEditing(c);
          setModalOpen(true);
        }}
        onRoteiro={handleGerarRoteiro}
        onPublicado={handlePublicado}
        onDelete={handleDelete}
        roteiroLoadingId={roteiroLoading ? roteiroTarget?.id ?? null : null}
      />

      <AddConteudoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        initial={editing}
        defaultMarca={activeMarca}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
