"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clapperboard,
  Image,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton } from "../action-button";
import { MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { useAlveszEventos } from "@/hooks/use-alvesz-eventos";
import { useConteudos } from "@/hooks/use-conteudos";
import { useEventos } from "@/hooks/use-eventos";
import { useGoals } from "@/hooks/use-goals";
import { useGrowthLeads } from "@/hooks/use-growth-leads";
import { useGrowthProfiles } from "@/hooks/use-growth-profiles";
import { useLanguageProgress } from "@/hooks/use-language-progress";
import { useLanguageSessions } from "@/hooks/use-language-sessions";
import { useLeads } from "@/hooks/use-leads";
import { useOrcamentos } from "@/hooks/use-orcamentos";
import { useSocialIaStatus } from "@/hooks/use-social-ia-status";
import { useSupabaseCrud } from "@/hooks/use-supabase-crud";
import { useTrips } from "@/hooks/use-trips";
import { useAuraXp } from "@/hooks/use-aura-xp";
import { awardAuraXpClient } from "@/lib/xp/client";
import { parseJsonResponse } from "@/utils/safe-json";
import type { Conteudo, InstagramMarca, XpAcao } from "@/types/database";
import { analyzeGrowthLeadContentInsights } from "@/utils/growth";
import {
  computeSocialMetrics,
  getConteudoStatusLabel,
  getNextConteudoStatus,
  getPrevConteudoStatus,
  getSocialGrowthHints,
  normalizeConteudoStatus,
  parseConteudoSuggestions,
  type ParsedConteudoSuggestion,
} from "@/utils/social";
import {
  DEFAULT_SOCIAL_FILTERS,
  filterConteudosSocial,
  type SocialContentFilters,
} from "@/utils/social-filters";
import {
  computeAllSocialOpportunities,
  computePostingStreak,
  computeSocialReport,
  opportunityToSuggestion,
  type SocialOpportunity,
} from "@/utils/social-intelligence";
import {
  AddConteudoModal,
  type ConteudoFormPayload,
} from "./add-conteudo-modal";
import { AuraSocial } from "./aura-social";
import { ConfirmPublishModal } from "./confirm-publish-modal";
import { InstagramProfilesPanel } from "./instagram-profiles-panel";
import { InstagramCalendarPanel } from "./instagram-calendar-panel";
import { InstagramPipelinePanel } from "./instagram-pipeline-panel";
import { SocialContentGoalsPanel } from "./social-content-goals-panel";
import { SocialContentToolbar } from "./social-content-toolbar";
import { SocialOpportunitiesPanel } from "./social-opportunities-panel";
import { SocialReportPanel } from "./social-report-panel";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";

const IA_UNAVAILABLE_MSG =
  "IA indisponível no momento. Você pode continuar cadastrando conteúdos manualmente.";

export function SocialMediaView() {
  const {
    data: conteudos,
    loading,
    error: conteudosError,
    refresh,
    create,
    update,
    remove,
  } = useConteudos();
  const { data: leads } = useGrowthLeads();
  const { data: consorciosLeads } = useLeads();
  const { data: orcamentos } = useOrcamentos();
  const { data: alveszEventos } = useAlveszEventos();
  const { data: eventos } = useEventos();
  const { data: trips } = useTrips();
  const { data: checklist } = useSupabaseCrud<"trip_checklist_items">({
    table: "trip_checklist_items",
    orderBy: "ordem",
  });
  const { data: languageProgress } = useLanguageProgress();
  const { data: languageSessions } = useLanguageSessions();
  const { data: profiles, refresh: refreshProfiles } = useGrowthProfiles();
  const { data: goals, loading: goalsLoading, refresh: refreshGoals } = useGoals();
  const { refresh: refreshXp } = useAuraXp();
  const {
    available: iaAvailable,
    reason: iaReason,
    loading: iaStatusLoading,
  } = useSocialIaStatus();

  const [activeMarca, setActiveMarca] = useState<InstagramMarca>("marca_pessoal");
  const [filters, setFilters] = useState<SocialContentFilters>(DEFAULT_SOCIAL_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Conteudo | null>(null);
  const [roteiroTarget, setRoteiroTarget] = useState<Conteudo | null>(null);
  const [roteiroLoading, setRoteiroLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<ParsedConteudoSuggestion[]>([]);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [iaLoading, setIaLoading] = useState<string | null>(null);
  const [publishModal, setPublishModal] = useState<{
    id?: string;
    titulo: string;
    plannedDate: string | null;
  } | null>(null);
  const [publishPending, setPublishPending] = useState(false);
  const publishResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const filtered = useMemo(() => {
    const withMarcaFilter: SocialContentFilters = {
      ...filters,
      marca: filters.marca === "all" ? activeMarca : filters.marca,
    };
    if (filters.marca === "all") {
      return filterConteudosSocial(
        conteudos.filter(
          (c) => c.marca === activeMarca || (!c.marca && activeMarca === "marca_pessoal")
        ),
        { ...filters, marca: "all" }
      );
    }
    return filterConteudosSocial(conteudos, withMarcaFilter);
  }, [conteudos, filters, activeMarca]);

  const metrics = useMemo(() => computeSocialMetrics(filtered), [filtered]);
  const contentInsights = useMemo(
    () => analyzeGrowthLeadContentInsights(leads),
    [leads]
  );
  const growthHints = useMemo(
    () => getSocialGrowthHints(contentInsights),
    [contentInsights]
  );

  const opportunities = useMemo(
    () =>
      computeAllSocialOpportunities({
        orcamentos,
        alveszEventos,
        eventos,
        leads: consorciosLeads,
        trips,
        checklist,
        languageProgress,
        languageSessions,
        goals,
        activeMarca,
      }),
    [
      orcamentos,
      alveszEventos,
      eventos,
      consorciosLeads,
      trips,
      checklist,
      languageProgress,
      languageSessions,
      goals,
      activeMarca,
    ]
  );

  const marcaConteudos = useMemo(
    () =>
      conteudos.filter(
        (c) => c.marca === activeMarca || (!c.marca && activeMarca === "marca_pessoal")
      ),
    [conteudos, activeMarca]
  );

  const reportSemana = useMemo(
    () => computeSocialReport(marcaConteudos, activeMarca, "semana"),
    [marcaConteudos, activeMarca]
  );
  const reportMes = useMemo(
    () => computeSocialReport(marcaConteudos, activeMarca, "mes"),
    [marcaConteudos, activeMarca]
  );
  const postingStreak = useMemo(
    () => computePostingStreak(marcaConteudos),
    [marcaConteudos]
  );

  const showIaBanner = !iaStatusLoading && !iaAvailable;
  const iaDisabled = iaStatusLoading || !iaAvailable;

  const awardSocialXp = useCallback(
    async (acao: XpAcao, idempotencyKey: string) => {
      const { awarded } = await awardAuraXpClient(acao, idempotencyKey);
      if (awarded) void refreshXp({ silent: true });
    },
    [refreshXp]
  );

  const requestPublishConfirm = useCallback(
    (info: { titulo: string; plannedDate: string | null; id?: string }) =>
      new Promise<boolean>((resolve) => {
        publishResolveRef.current = resolve;
        setPublishModal(info);
      }),
    []
  );

  const closePublishModal = useCallback((confirmed: boolean) => {
    publishResolveRef.current?.(confirmed);
    publishResolveRef.current = null;
    setPublishModal(null);
  }, []);

  function notifyIaUnavailable() {
    toast.error(iaReason ?? IA_UNAVAILABLE_MSG);
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  async function executePublish(id: string) {
    setStatusLoadingId(id);
    const { error } = await update(id, {
      status: "publicado",
      data_publicada_em: new Date().toISOString(),
    });
    setStatusLoadingId(null);

    if (error) {
      toast.error(error);
      return false;
    }

    toast.success("Marcado como publicado.");
    await awardSocialXp("publicar_conteudo", `conteudo:${id}:publicado`);
    void refreshGoals();
    return true;
  }

  async function handleSubmit(payload: ConteudoFormPayload) {
    const withMarca = { ...payload, marca: payload.marca ?? activeMarca };
    const isPublishing = normalizeConteudoStatus(payload.status) === "publicado";
    const wasPublished =
      editing && normalizeConteudoStatus(editing.status) === "publicado";

    if (isPublishing) {
      const publishFields = {
        ...withMarca,
        data_publicada_em: editing?.data_publicada_em ?? new Date().toISOString(),
      };
      if (editing) {
        const result = await update(editing.id, publishFields);
        if (!result.error && !wasPublished) {
          await awardSocialXp("publicar_conteudo", `conteudo:${editing.id}:publicado`);
          void refreshGoals();
        }
        return result;
      }
      const result = await create(publishFields);
      if (!result.error && result.data) {
        await awardSocialXp("criar_conteudo", `conteudo:${result.data.id}:criado`);
        await awardSocialXp("publicar_conteudo", `conteudo:${result.data.id}:publicado`);
        void refreshGoals();
      }
      return result;
    }

    const fields = wasPublished
      ? { ...withMarca, data_publicada_em: null }
      : withMarca;

    if (editing) return update(editing.id, fields);

    const result = await create(fields);
    if (!result.error && result.data) {
      await awardSocialXp("criar_conteudo", `conteudo:${result.data.id}:criado`);
    }
    return result;
  }

  async function handleGerarRoteiro(item: Conteudo) {
    if (iaDisabled) {
      notifyIaUnavailable();
      return;
    }

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
          marca: item.marca ?? activeMarca,
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
      else {
        toast.success("Roteiro gerado e salvo.");
        await awardSocialXp("gerar_roteiro", `conteudo:${item.id}:roteiro`);
      }
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
    if (iaDisabled) {
      notifyIaUnavailable();
      return;
    }

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

  function handleAddOpportunity(opp: SocialOpportunity) {
    const suggestion = opportunityToSuggestion(opp);
    setPendingSuggestions((current) => [
      ...current,
      {
        titulo: suggestion.titulo,
        plataforma: suggestion.plataforma,
        formato: suggestion.formato,
        objetivo: suggestion.objetivo,
        observacoes: suggestion.observacoes,
        data: null,
        roteiro: null,
        marca: suggestion.marca,
      },
    ]);
    toast.success("Oportunidade adicionada às sugestões.");
  }

  function handleAddAllOpportunities() {
    const suggestions = opportunities.map((opp) => {
      const s = opportunityToSuggestion(opp);
      return {
        titulo: s.titulo,
        plataforma: s.plataforma,
        formato: s.formato,
        objetivo: s.objetivo,
        observacoes: s.observacoes,
        data: null,
        roteiro: null,
        marca: s.marca,
      };
    });
    setPendingSuggestions(suggestions);
    toast.success(`${suggestions.length} oportunidade(s) prontas para salvar.`);
  }

  async function handleSaveSuggestions() {
    if (pendingSuggestions.length === 0) return;
    setSavingSuggestions(true);

    let saved = 0;
    for (const item of pendingSuggestions) {
      const data_publicacao = item.data
        ? new Date(`${item.data}T12:00:00`).toISOString()
        : null;

      const { error, data } = await create({
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

      if (!error) {
        saved++;
        if (data) {
          await awardSocialXp("criar_conteudo", `conteudo:${data.id}:criado`);
          if (item.roteiro) {
            await awardSocialXp("gerar_roteiro", `conteudo:${data.id}:roteiro`);
          }
        }
      }
    }

    setSavingSuggestions(false);
    setPendingSuggestions([]);
    if (saved > 0) toast.success(`${saved} conteúdo(s) adicionado(s).`);
    else toast.error("Não foi possível salvar.");
  }

  async function handlePublicado(id: string) {
    const item = conteudos.find((c) => c.id === id);
    if (!item) return;

    await requestPublishConfirm({
      id,
      titulo: item.titulo,
      plannedDate: item.data_publicacao?.slice(0, 10) ?? null,
    });
  }

  async function handlePublishModalConfirm() {
    if (!publishModal) return;
    setPublishPending(true);

    if (publishModal.id) {
      const ok = await executePublish(publishModal.id);
      closePublishModal(ok);
    } else {
      closePublishModal(true);
    }

    setPublishPending(false);
  }

  async function handleAdvanceStatus(item: Conteudo) {
    const current = normalizeConteudoStatus(item.status);
    const next = getNextConteudoStatus(current);
    if (!next) return;

    if (next === "publicado") {
      await handlePublicado(item.id);
      return;
    }

    setStatusLoadingId(item.id);
    const { error } = await update(item.id, { status: next });
    setStatusLoadingId(null);

    if (error) toast.error(error);
    else toast.success(`Status: ${getConteudoStatusLabel(next)}`);
  }

  async function handleRetreatStatus(item: Conteudo) {
    const current = normalizeConteudoStatus(item.status);
    const prev = getPrevConteudoStatus(current);
    if (!prev) return;

    setStatusLoadingId(item.id);
    const payload =
      current === "publicado"
        ? { status: prev, data_publicada_em: null }
        : { status: prev };

    const { error } = await update(item.id, payload);
    setStatusLoadingId(null);

    if (error) toast.error(error);
    else toast.success(`Status: ${getConteudoStatusLabel(prev)}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este conteúdo?")) return;
    const { error } = await remove(id);
    if (error) toast.error(error);
    else toast.success("Conteúdo excluído.");
  }

  return (
    <div className="space-y-3">
      {conteudosError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100/90">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {conteudosError}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-[12px] font-medium text-amber-200 hover:bg-amber-500/15 md:min-h-0 md:px-2 md:py-1 md:text-[11px]"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {showIaBanner && (
        <Panel className="border-violet-500/20 bg-violet-500/[0.06]">
          <PanelContent className="flex gap-2 py-2.5">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-300" />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-violet-100">IA indisponível</p>
              <p className="mt-0.5 text-[11px] text-violet-200/70">
                {iaReason ?? IA_UNAVAILABLE_MSG}
              </p>
            </div>
          </PanelContent>
        </Panel>
      )}

      <InstagramProfilesPanel
        profiles={profiles}
        activeMarca={activeMarca}
        onMarcaChange={setActiveMarca}
        onRefresh={() => void refreshProfiles()}
      />

      {loading ? (
        <MetricsSkeleton />
      ) : (
        <SocialContentGoalsPanel
          conteudos={conteudos}
          goals={goals}
          goalsLoading={goalsLoading}
          activeMarca={activeMarca}
          streak={postingStreak}
        />
      )}

      {!loading && (
        <SocialReportPanel reportSemana={reportSemana} reportMes={reportMes} />
      )}

      {!loading && (
        <SocialOpportunitiesPanel
          opportunities={opportunities}
          onAddOpportunity={handleAddOpportunity}
          onAddAll={opportunities.length > 0 ? handleAddAllOpportunities : undefined}
        />
      )}

      <SocialContentToolbar
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
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
          disabled={Boolean(iaLoading) || iaDisabled}
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
          disabled={Boolean(iaLoading) || iaDisabled}
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
          disabled={Boolean(iaLoading) || iaDisabled}
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
          disabled={Boolean(iaLoading) || iaDisabled}
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
          disabled={Boolean(iaLoading) || iaDisabled}
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

      {!loading && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-white/[0.06] bg-zinc-950/30 px-2 py-1.5">
            <p className="text-[10px] text-zinc-500">Ideias</p>
            <p className="text-[14px] font-semibold text-zinc-200">{metrics.ideias}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-zinc-950/30 px-2 py-1.5">
            <p className="text-[10px] text-zinc-500">Em produção</p>
            <p className="text-[14px] font-semibold text-zinc-200">{metrics.emProducao}</p>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-zinc-950/30 px-2 py-1.5">
            <p className="text-[10px] text-zinc-500">Publicados</p>
            <p className="text-[14px] font-semibold text-zinc-200">{metrics.publicados}</p>
          </div>
        </div>
      )}

      <AuraSocial
        leads={leads}
        marca={activeMarca}
        iaAvailable={iaAvailable}
        iaReason={iaReason}
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
        loadError={conteudosError}
        onEdit={(c) => {
          setEditing(c);
          setModalOpen(true);
        }}
        onRoteiro={handleGerarRoteiro}
        onAdvanceStatus={handleAdvanceStatus}
        onRetreatStatus={handleRetreatStatus}
        onDelete={handleDelete}
        roteiroLoadingId={roteiroLoading ? roteiroTarget?.id ?? null : null}
        statusLoadingId={statusLoadingId}
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
        onPublishConfirm={(info) =>
          requestPublishConfirm({
            titulo: info.titulo,
            plannedDate: info.plannedDate,
          })
        }
      />

      <ConfirmPublishModal
        open={Boolean(publishModal)}
        onClose={() => closePublishModal(false)}
        onConfirm={() => void handlePublishModalConfirm()}
        titulo={publishModal?.titulo ?? ""}
        plannedDate={publishModal?.plannedDate ?? null}
        pending={publishPending}
      />
    </div>
  );
}
