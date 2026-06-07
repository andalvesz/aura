"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { GoogleCalendarPanel } from "@/components/dashboard/google-calendar-panel";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { ActionButton } from "@/components/dashboard/action-button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useEventos } from "@/hooks/use-eventos";
import { useGastos } from "@/hooks/use-gastos";
import { useTripChecklist } from "@/hooks/use-trip-checklist";
import { useTrips } from "@/hooks/use-trips";
import { awardAuraXpClient } from "@/lib/xp/client";
import { formatBRL } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  CHAT_INPUT_CLASS,
  CHAT_SEND_CLASS,
} from "@/utils/dashboard-mobile";
import type { Trip, TripChecklistCategoria, TripStatus } from "@/types/database";
import {
  computeBudgetProgress,
  computeChecklistProgress,
  daysUntilTrip,
  formatBudgetSummary,
  formatTripDateRange,
  getChecklistCategoriaLabel,
  getTripStatusLabel,
  groupChecklistByCategoria,
  parseTravelAiResponse,
  sumViagemGastos,
  upcomingTrip,
  type ParsedTravelAiResponse,
} from "@/utils/travel";
import {
  addDaysToIsoDate,
  getTravelTemplate,
} from "@/utils/travel-templates";
import { AddTripModal } from "./add-trip-modal";

export function ViagensView() {
  const { data: trips, loading, create, remove, update } = useTrips();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const activeTrip = useMemo(() => {
    if (selectedId) return trips.find((t) => t.id === selectedId) ?? null;
    return upcomingTrip(trips);
  }, [trips, selectedId]);

  const {
    data: checklist,
    loading: loadingChecklist,
    update: updateChecklist,
    create: createChecklist,
    refresh: refreshChecklist,
  } = useTripChecklist(activeTrip?.id ?? null);

  const { data: gastos } = useGastos();
  const { create: createEvento } = useEventos();

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<ParsedTravelAiResponse | null>(null);

  const metrics = useMemo(() => {
    if (!activeTrip) return null;
    const dias = daysUntilTrip(activeTrip);
    const financeGastos = sumViagemGastos(gastos, activeTrip);
    const gastoTotal = Math.max(activeTrip.gasto_atual, financeGastos);
    const checklistPct = computeChecklistProgress(checklist);
    const budgetPct = computeBudgetProgress({
      ...activeTrip,
      gasto_atual: gastoTotal,
    });

    return {
      dias,
      gastoTotal,
      checklistPct,
      budgetPct,
      budgetLabel: formatBudgetSummary({ ...activeTrip, gasto_atual: gastoTotal }),
    };
  }, [activeTrip, checklist, gastos]);

  const groupedChecklist = useMemo(
    () => groupChecklistByCategoria(checklist),
    [checklist]
  );

  async function handleCreateTrip(payload: {
    nome: string;
    destino: string;
    data_ida: string;
    data_volta: string;
    orcamento: number;
    status: TripStatus;
    template_id: string | null;
  }) {
    const { error, data } = await create(payload);
    if (error) return { error };
    if (data?.id) setSelectedId(data.id);
    await awardAuraXpClient("criar_viagem");
    return { error: null };
  }

  async function handleToggleChecklist(id: string, current: string) {
    const next = current === "feito" ? "pendente" : "feito";
    const { error } = await updateChecklist(id, next as "feito" | "pendente");
    if (error) {
      toast.error(error);
      return;
    }
    if (next === "feito") await awardAuraXpClient("completar_checklist_viagem");
    toast.success(next === "feito" ? "Item concluído." : "Item reaberto.");
  }

  async function handleAiSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTrip || !aiInput.trim()) return;

    setAiLoading(true);
    try {
      const res = await fetch("/api/travel-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: aiInput.trim(),
          destino: activeTrip.destino,
          data_ida: activeTrip.data_ida,
          data_volta: activeTrip.data_volta,
          orcamento: activeTrip.orcamento,
          template_id: activeTrip.template_id,
        }),
      });
      const { data, error } = await parseJsonResponse<{ plan?: ParsedTravelAiResponse; error?: string }>(res);
      if (error || !data?.plan) {
        toast.error(data?.error ?? error ?? "Erro ao gerar plano.");
        return;
      }
      setAiPlan(parseTravelAiResponse(data.plan));
      setAiInput("");
      toast.success("Plano gerado pela IA.");
    } catch {
      toast.error("Erro ao conectar com a IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApplyChecklist() {
    if (!activeTrip || !aiPlan?.checklist.length) return;
    if (!confirm(`Adicionar ${aiPlan.checklist.length} itens ao checklist?`)) return;

    for (const item of aiPlan.checklist) {
      const validCategorias: TripChecklistCategoria[] = [
        "documentos",
        "passaporte",
        "visto",
        "ingressos",
        "hospedagem",
        "seguro",
        "transporte",
      ];
      const categoria: TripChecklistCategoria = validCategorias.includes(
        item.categoria as TripChecklistCategoria
      )
        ? (item.categoria as TripChecklistCategoria)
        : "documentos";

      await createChecklist({ categoria, titulo: item.titulo });
    }
    await refreshChecklist();
    toast.success("Checklist atualizado.");
  }

  async function handleApplyRoteiro() {
    if (!activeTrip || !aiPlan?.roteiro.length) return;
    if (!confirm(`Criar ${aiPlan.roteiro.length} eventos no calendário?`)) return;

    for (const dia of aiPlan.roteiro) {
      const data = addDaysToIsoDate(activeTrip.data_ida, dia.dia - 1);
      const descricao = dia.atividades.join("\n");
      await createEvento({
        titulo: `${activeTrip.nome}: ${dia.titulo}`,
        descricao,
        data_inicio: `${data}T09:00:00`,
        data_fim: null,
        local: activeTrip.destino,
        tipo: "viagem",
        growth_lead_id: null,
      });
    }
    toast.success("Roteiro adicionado ao calendário.");
  }

  async function handleApplyTemplateEvents() {
    if (!activeTrip?.template_id) return;
    const template = getTravelTemplate(activeTrip.template_id);
    if (!template?.eventos.length) return;
    if (!confirm(`Criar ${template.eventos.length} eventos do template?`)) return;

    for (const ev of template.eventos) {
      const data = addDaysToIsoDate(activeTrip.data_ida, ev.offsetDays);
      await createEvento({
        titulo: ev.titulo,
        descricao: ev.descricao ?? null,
        data_inicio: `${data}T${ev.hora}:00`,
        data_fim: null,
        local: ev.local,
        tipo: "viagem",
        growth_lead_id: null,
      });
    }
    toast.success("Eventos do template criados.");
  }

  async function handleDeleteTrip(trip: Trip) {
    if (!confirm(`Excluir viagem "${trip.nome}"?`)) return;
    const { error } = await remove(trip.id);
    if (error) {
      toast.error(error);
      return;
    }
    if (selectedId === trip.id) setSelectedId(null);
    toast.success("Viagem excluída.");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={3} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ActionButton onClick={() => setModalOpen(true)} icon={<Plus className="size-3.5" />}>
          Nova viagem
        </ActionButton>
        {activeTrip?.template_id && (
          <ActionButton
            onClick={handleApplyTemplateEvents}
            icon={<CalendarDays className="size-3.5" />}
            variant="ghost"
          >
            Aplicar roteiro do template
          </ActionButton>
        )}
      </div>

      {!trips.length ? (
        <EmptyState
          title="Nenhuma viagem planejada"
          description="Crie sua primeira viagem ou use o template Disney + NBA Experience."
          action={
            <ActionButton
              onClick={() => setModalOpen(true)}
              icon={<Plus className="size-3.5" />}
            >
              Nova viagem
            </ActionButton>
          }
        />
      ) : (
        <>
          {activeTrip && metrics && (
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCard
                label="Dias restantes"
                value={
                  metrics.dias < 0
                    ? "Encerrada"
                    : metrics.dias === 0
                      ? "Em viagem"
                      : String(metrics.dias)
                }
                hint={formatTripDateRange(activeTrip)}
              />
              <MetricCard
                label="Orçamento"
                value={metrics.budgetLabel}
                hint={`${metrics.budgetPct}% utilizado`}
              />
              <MetricCard
                label="Progresso"
                value={`${metrics.checklistPct}%`}
                hint="Checklist da viagem"
              />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Viagens</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-2">
                {trips.map((trip) => {
                  const selected = activeTrip?.id === trip.id;
                  const dias = daysUntilTrip(trip);
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => setSelectedId(trip.id)}
                      className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? "border-sky-500/30 bg-sky-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-zinc-100">
                          {trip.nome}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {trip.destino} · {getTripStatusLabel(trip.status)}
                        </p>
                        <p className="text-[11px] text-zinc-600">
                          {formatTripDateRange(trip)}
                          {dias > 0 ? ` · ${dias}d` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteTrip(trip);
                        }}
                        className="shrink-0 rounded p-1 text-zinc-600 hover:text-rose-400"
                        aria-label="Excluir viagem"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </button>
                  );
                })}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-sky-400" />
                  Checklist
                </PanelTitle>
              </PanelHeader>
              <PanelContent>
                {!activeTrip ? (
                  <p className="text-[12px] text-zinc-500">Selecione uma viagem.</p>
                ) : loadingChecklist ? (
                  <ListSkeleton rows={3} />
                ) : !checklist.length ? (
                  <p className="text-[12px] text-zinc-500">Nenhum item no checklist.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(groupedChecklist).map(([categoria, items]) => (
                      <div key={categoria}>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                          {getChecklistCategoriaLabel(categoria)}
                        </p>
                        <ul className="space-y-1">
                          {items.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => void handleToggleChecklist(item.id, item.status)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-white/[0.04]"
                              >
                                <span
                                  className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                                    item.status === "feito"
                                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                                      : "border-white/[0.12] text-transparent"
                                  }`}
                                >
                                  <Check className="size-2.5" />
                                </span>
                                <span
                                  className={
                                    item.status === "feito"
                                      ? "text-zinc-500 line-through"
                                      : "text-zinc-300"
                                  }
                                >
                                  {item.titulo}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </PanelContent>
            </Panel>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle className="flex items-center gap-2">
                  <Bot className="size-3.5 text-sky-400" />
                  IA — Planejar viagem
                </PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-3">
                {!activeTrip ? (
                  <p className="text-[12px] text-zinc-500">Selecione uma viagem para usar a IA.</p>
                ) : (
                  <>
                    <form onSubmit={handleAiSend} className="flex gap-2">
                      <input
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder="Ex: Monte roteiro de 5 dias com custos e preparação"
                        className={CHAT_INPUT_CLASS}
                        disabled={aiLoading}
                      />
                      <button
                        type="submit"
                        disabled={aiLoading || !aiInput.trim()}
                        className={CHAT_SEND_CLASS}
                      >
                        {aiLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                      </button>
                    </form>

                    {aiPlan && (
                      <div className="space-y-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[12px]">
                        {aiPlan.roteiro.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-zinc-300">Roteiro</p>
                            <ul className="space-y-1 text-zinc-500">
                              {aiPlan.roteiro.map((d) => (
                                <li key={d.dia}>
                                  <strong className="text-zinc-400">Dia {d.dia}:</strong>{" "}
                                  {d.titulo}
                                  {d.atividades.length > 0 && (
                                    <span className="block pl-2">
                                      {d.atividades.join(" · ")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => void handleApplyRoteiro()}
                              className="mt-2 text-sky-400 hover:underline"
                            >
                              Salvar no calendário
                            </button>
                          </div>
                        )}

                        {aiPlan.checklist.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-zinc-300">Checklist sugerido</p>
                            <ul className="list-inside list-disc text-zinc-500">
                              {aiPlan.checklist.map((c, i) => (
                                <li key={i}>{c.titulo}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => void handleApplyChecklist()}
                              className="mt-2 text-sky-400 hover:underline"
                            >
                              Adicionar ao checklist
                            </button>
                          </div>
                        )}

                        {aiPlan.estimativa_custos.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-zinc-300">Estimativa de custos</p>
                            <ul className="text-zinc-500">
                              {aiPlan.estimativa_custos.map((c, i) => (
                                <li key={i}>
                                  {c.item}: {formatBRL(c.valor)}
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() =>
                                void update(activeTrip.id, {
                                  orcamento: aiPlan.estimativa_custos.reduce(
                                    (s, c) => s + c.valor,
                                    0
                                  ),
                                })
                              }
                              className="mt-2 text-sky-400 hover:underline"
                            >
                              Aplicar orçamento estimado
                            </button>
                          </div>
                        )}

                        {aiPlan.preparacao.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-zinc-300">Preparação</p>
                            <ul className="list-inside list-disc text-zinc-500">
                              {aiPlan.preparacao.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {aiPlan.dicas.length > 0 && (
                          <div>
                            <p className="mb-1 font-medium text-zinc-300">Dicas</p>
                            <ul className="list-inside list-disc text-zinc-500">
                              {aiPlan.dicas.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Integrações</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-3 text-[12px]">
                <IntegrationLink
                  href="/dashboard/metas"
                  icon={Target}
                  label="Metas"
                  hint="Defina meta financeira para economizar para a viagem"
                />
                <IntegrationLink
                  href="/dashboard/financeiro"
                  icon={Wallet}
                  label="Financeiro"
                  hint={
                    activeTrip && metrics
                      ? `Gastos viagem: ${formatBRL(metrics.gastoTotal)} (categoria viagem)`
                      : "Registre gastos com categoria viagem"
                  }
                />
                <IntegrationLink
                  href="/dashboard/calendario"
                  icon={CalendarDays}
                  label="Calendário"
                  hint="Eventos tipo viagem sincronizam com Google Calendar"
                />
                <GoogleCalendarPanel />
              </PanelContent>
            </Panel>
          </div>
        </>
      )}

      <AddTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateTrip}
      />
    </div>
  );
}

function IntegrationLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-sky-400" />
      <div>
        <p className="font-medium text-zinc-200">{label}</p>
        <p className="text-[11px] text-zinc-500">{hint}</p>
      </div>
    </Link>
  );
}
