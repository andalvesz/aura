"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  Castle,
  Languages,
  Loader2,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Target,
  Ticket,
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
import { useFinancialGoals } from "@/hooks/use-financial-goals";
import { useGastos } from "@/hooks/use-gastos";
import { useGoals } from "@/hooks/use-goals";
import { useLanguageLessons } from "@/hooks/use-language-lessons";
import { useLanguageProgress } from "@/hooks/use-language-progress";
import { useLanguageSessions } from "@/hooks/use-language-sessions";
import { useTripChecklist } from "@/hooks/use-trip-checklist";
import { useTrips } from "@/hooks/use-trips";
import { awardAuraXpClient } from "@/lib/xp/client";
import type { TripStatus } from "@/types/database";
import {
  CHAT_INPUT_CLASS,
  CHAT_SEND_CLASS,
} from "@/utils/dashboard-mobile";
import {
  DISNEY_NBA_AI_PROMPTS,
  DISNEY_NBA_TEMPLATE_ID,
  buildEnglishSummaryLines,
  computeDisneyNbaDashboard,
  formatCountdown,
  formatCountdownHint,
  type DisneyNbaAiPromptId,
} from "@/utils/disney-nba";
import { formatBRL } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";
import { getTravelTemplate } from "@/utils/travel-templates";
import { AddTripModal } from "./add-trip-modal";

export function DisneyNbaView() {
  const { data: trips, loading: loadingTrips, create } = useTrips();
  const { data: goals, loading: loadingGoals } = useGoals();
  const { data: financialGoals, loading: loadingFinancialGoals } = useFinancialGoals();
  const { data: gastos } = useGastos();
  const { data: eventos, refresh: refreshEventos } = useEventos();
  const { data: languageProgress, loading: loadingProgress } = useLanguageProgress();
  const { data: languageSessions } = useLanguageSessions();
  const { data: languageLessons } = useLanguageLessons();

  const dashboard = useMemo(
    () =>
      computeDisneyNbaDashboard({
        trips,
        checklist: [],
        goals,
        financialGoals,
        gastos,
        eventos,
        languageProgress,
        languageSessions,
        languageLessons,
      }),
    [
      trips,
      goals,
      financialGoals,
      gastos,
      eventos,
      languageProgress,
      languageSessions,
      languageLessons,
    ]
  );

  const {
    data: checklist,
    loading: loadingChecklist,
    update: updateChecklist,
  } = useTripChecklist(dashboard.trip?.id ?? null);

  const fullDashboard = useMemo(
    () =>
      computeDisneyNbaDashboard({
        trips,
        checklist,
        goals,
        financialGoals,
        gastos,
        eventos,
        languageProgress,
        languageSessions,
        languageLessons,
      }),
    [
      trips,
      checklist,
      goals,
      financialGoals,
      gastos,
      eventos,
      languageProgress,
      languageSessions,
      languageLessons,
    ]
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);

  const englishLines = useMemo(
    () => buildEnglishSummaryLines(languageProgress, languageSessions, languageLessons),
    [languageProgress, languageSessions, languageLessons]
  );

  const loading =
    loadingTrips ||
    loadingGoals ||
    loadingFinancialGoals ||
    loadingProgress ||
    (fullDashboard.trip && loadingChecklist);

  async function handleCreateTrip(payload: {
    nome: string;
    destino: string;
    data_ida: string;
    data_volta: string;
    orcamento: number;
    status: TripStatus;
    template_id: string | null;
  }) {
    const { error } = await create({
      ...payload,
      template_id: payload.template_id ?? DISNEY_NBA_TEMPLATE_ID,
    });
    if (error) return { error };
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
    if (next === "feito") {
      await awardAuraXpClient("completar_checklist_viagem", `checklist:${id}:feito`);
    }
    toast.success(next === "feito" ? "Item concluído." : "Item reaberto.");
  }

  async function handleAiSend(
    message: string,
    promptId?: DisneyNbaAiPromptId
  ) {
    const trimmed = message.trim();
    if (!trimmed) return;

    setAiLoading(true);
    try {
      const res = await fetch("/api/disney-nba-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          prompt_id: promptId,
          trips,
          checklist,
          goals,
          financialGoals,
          gastos,
          eventos,
          languageProgress,
          languageSessions,
          languageLessons,
        }),
      });
      const { data, error } = await parseJsonResponse<{
        reply?: string;
        error?: string;
      }>(res);

      if (error || !data?.reply) {
        toast.error(data?.error ?? error ?? "Erro ao consultar IA.");
        return;
      }

      setAiReply(data.reply);
      if (!promptId) setAiInput("");
      toast.success("Resposta da IA pronta.");
    } catch {
      toast.error("Erro ao conectar com a IA.");
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  const template = getTravelTemplate(DISNEY_NBA_TEMPLATE_ID);

  if (!fullDashboard.trip) {
    return (
      <div className="space-y-3">
        <EmptyState
          title="Central Disney + NBA"
          description="Crie sua viagem com o template Disney + NBA Experience para acompanhar contagem regressiva, finanças, checklist, inglês e calendário em um só lugar."
          action={
            <ActionButton
              onClick={() => setModalOpen(true)}
              icon={<Plus className="size-3.5" />}
            >
              Criar viagem Disney + NBA
            </ActionButton>
          }
        />
        <AddTripModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreateTrip}
        />
      </div>
    );
  }

  const trip = fullDashboard.trip;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          onClick={() => setModalOpen(true)}
          icon={<Plus className="size-3.5" />}
          variant="ghost"
        >
          Nova viagem
        </ActionButton>
        <Link
          href="/dashboard/viagens"
          className="text-[12px] text-zinc-500 hover:text-zinc-300"
        >
          Abrir Aura Travel →
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Contagem regressiva"
          value={formatCountdown(fullDashboard.daysUntil)}
          hint={formatCountdownHint(trip, fullDashboard.daysUntil)}
          className="border-fuchsia-500/20"
        />
        <MetricCard
          label="Valor necessário"
          value={formatBRL(fullDashboard.requiredAmount)}
          hint={template?.destino ?? trip.destino}
        />
        <MetricCard
          label="Valor acumulado"
          value={formatBRL(fullDashboard.accumulatedAmount)}
          hint={`${fullDashboard.savingsPct}% da meta`}
          hintClassName={fullDashboard.onBudget ? "text-emerald-500" : "text-amber-500"}
        />
        <MetricCard
          label="Meta mensal"
          value={formatBRL(fullDashboard.monthlyTarget)}
          hint={`${fullDashboard.monthsRemaining} meses até a viagem`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Check className="size-3.5 text-emerald-400" />
              Checklist geral
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">
                {fullDashboard.checklistDone}/{fullDashboard.checklistTotal} concluídos
              </span>
              <span className="font-medium text-zinc-200">
                {fullDashboard.checklistPct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-500/70 transition-all"
                style={{ width: `${fullDashboard.checklistPct}%` }}
              />
            </div>
            {checklist.length === 0 ? (
              <p className="text-[12px] text-zinc-500">Checklist vazio.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {checklist.slice(0, 8).map((item) => (
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
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Castle className="size-3.5 text-fuchsia-400" />
              Documentos e reservas
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="grid gap-2 sm:grid-cols-2">
            {fullDashboard.checklistByCategory.map((cat) => (
              <CategoryStatusCard key={cat.categoria} status={cat} />
            ))}
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Languages className="size-3.5 text-violet-400" />
              Progresso do inglês
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-zinc-400">Preparação para viagem</span>
              <span className="text-[13px] font-semibold text-zinc-100">
                {fullDashboard.englishProgressPct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-violet-500/70 transition-all"
                style={{ width: `${fullDashboard.englishProgressPct}%` }}
              />
            </div>
            <ul className="space-y-1 text-[12px] text-zinc-500">
              {englishLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <Link
              href="/dashboard/idiomas"
              className="inline-block text-[12px] text-violet-400 hover:underline"
            >
              Praticar no English Coach →
            </Link>
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-sky-400" />
              Próximos eventos da viagem
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {fullDashboard.upcomingEvents.length === 0 ? (
              <p className="text-[12px] text-zinc-500">
                Nenhum evento futuro. Aplique o roteiro do template em{" "}
                <Link href="/dashboard/viagens" className="text-sky-400 hover:underline">
                  Aura Travel
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {fullDashboard.upcomingEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <p className="text-[13px] font-medium text-zinc-200">{ev.titulo}</p>
                    <p className="text-[11px] text-zinc-500">
                      {ev.data_inicio.slice(0, 16).replace("T", " ")}
                      {ev.local ? ` · ${ev.local}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/dashboard/calendario"
              className="inline-block text-[12px] text-sky-400 hover:underline"
            >
              Ver calendário completo →
            </Link>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-fuchsia-400" />
            Integrações
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <IntegrationLink
            href="/dashboard/viagens"
            icon={MapPin}
            label="Travel"
            hint="Checklist, roteiro e template Disney + NBA"
          />
          <IntegrationLink
            href="/dashboard/idiomas"
            icon={Languages}
            label="English Coach"
            hint="Modos Disney e NBA para praticar"
          />
          <IntegrationLink
            href="/dashboard/financeiro"
            icon={Wallet}
            label="Financeiro"
            hint={`Gastos viagem: ${formatBRL(fullDashboard.tripGastos)}`}
          />
          <IntegrationLink
            href="/dashboard/metas"
            icon={Target}
            label="Metas"
            hint="Meta financeira para economizar"
          />
          <IntegrationLink
            href="/dashboard/calendario"
            icon={CalendarDays}
            label="Calendário"
            hint="Eventos tipo viagem"
          />
          <IntegrationLink
            href="/dashboard/calendario"
            icon={Ticket}
            label="Google Calendar"
            hint="Sincronização bidirecional"
          />
        </PanelContent>
      </Panel>

      <GoogleCalendarPanel onImported={() => void refreshEventos()} />

      <Panel>
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Bot className="size-3.5 text-fuchsia-400" />
            IA — Central Disney + NBA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {DISNEY_NBA_AI_PROMPTS.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                disabled={aiLoading}
                onClick={() => void handleAiSend(prompt.message, prompt.id)}
                className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20 disabled:opacity-50"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAiSend(aiInput);
            }}
            className="flex gap-2"
          >
            <input
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Pergunte sobre preparação, orçamento, inglês ou checklist..."
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

          {aiReply && (
            <div className="whitespace-pre-wrap rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] leading-relaxed text-zinc-300">
              {aiReply}
            </div>
          )}
        </PanelContent>
      </Panel>

      <AddTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateTrip}
      />
    </div>
  );
}

function CategoryStatusCard({
  status,
}: {
  status: {
    label: string;
    done: number;
    total: number;
    pct: number;
  };
}) {
  const complete = status.total > 0 && status.pct === 100;
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[12px] font-medium text-zinc-200">{status.label}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        {status.total === 0
          ? "Sem itens"
          : `${status.done}/${status.total} · ${status.pct}%`}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-all ${
            complete ? "bg-emerald-500/70" : "bg-fuchsia-500/50"
          }`}
          style={{ width: `${status.pct}%` }}
        />
      </div>
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
      <Icon className="mt-0.5 size-4 shrink-0 text-fuchsia-400" />
      <div>
        <p className="text-[12px] font-medium text-zinc-200">{label}</p>
        <p className="text-[11px] text-zinc-500">{hint}</p>
      </div>
    </Link>
  );
}
